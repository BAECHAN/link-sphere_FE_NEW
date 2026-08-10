import { TEXTS } from '@/shared/config/texts';
import { UserFacingError } from '@/shared/types/common.type';

const SVG_EXTENSION = 'svg';
const SVG_MIME_TYPE = 'image/svg+xml';
const GIF_EXTENSION = 'gif';
const GIF_MIME_TYPE = 'image/gif';
const WEBP_QUALITY = 0.85;

// 포맷과 무관하게 원본 자체가 지나치게 크면 리사이즈를 시도하기도 전에 먼저 막는다 - Discord도
// 서버에서 재압축하기 전에 원본을 10MB로 먼저 막는 것과 같은 방식(포맷 상관없이 원본 단계에서
// 일괄 차단). 리사이즈 대상(jpg/png 등)은 이 상한만 넘지 않으면 이후 크기와 무관하게 축소된다.
const MAX_ORIGINAL_FILE_SIZE_MB = 30;
const MAX_ORIGINAL_FILE_SIZE_BYTES = MAX_ORIGINAL_FILE_SIZE_MB * 1024 * 1024;

// SVG는 항상, GIF는 skipGifResize가 true인 호출부(기본값 - 댓글 이미지)에서만 리사이즈 없이
// 원본 그대로 업로드되므로 이때만 위 원본 상한과 별개로 더 낮은 상한을 둔다. 다른 서비스의 아바타
// 업로드 제한(GitHub 1MB, Slack 1MB, X 2MB, Discord 10MB - 애니메이션 GIF 아바타를 지원하는
// Discord가 가장 관대함) 중 가장 관대한 기준보다 여유를 두었다. Supabase 프로젝트 전역 상한
// (무료 플랜 50MB)에는 충분히 안전하지만, 버킷별 커스텀 설정은 코드로 확인할 수 없으므로 실제
// 값은 Supabase 대시보드에서 별도 확인 필요.
const MAX_UNRESIZABLE_FILE_SIZE_MB = 15;
const MAX_UNRESIZABLE_FILE_SIZE_BYTES = MAX_UNRESIZABLE_FILE_SIZE_MB * 1024 * 1024;

function getExtension(file: File): string | undefined {
  return file.name.split('.').pop()?.toLowerCase();
}

function isSvg(file: File): boolean {
  return file.type === SVG_MIME_TYPE || getExtension(file) === SVG_EXTENSION;
}

function isGif(file: File): boolean {
  return file.type === GIF_MIME_TYPE || getExtension(file) === GIF_EXTENSION;
}

interface ResizeOptions {
  /**
   * true(기본값)면 GIF도 SVG처럼 리사이즈 없이 원본 그대로 업로드한다(애니메이션 보존).
   * false면 GIF도 일반 이미지와 동일하게 리사이즈된다(정지 이미지로 변환) - 아바타처럼 항상
   * 작게 고정 크기로만 표시되어 애니메이션을 지킬 실익이 없는 경우에 쓴다.
   * SVG는 이 옵션과 무관하게 항상 원본을 유지한다 - Supabase 이미지 변환이 SVG는 건너뛰고
   * 원본을 그대로 내려주므로(supabaseImage.ts) 확대가능성이 실제로 의미가 있다.
   */
  skipGifResize?: boolean;
}

function shouldSkipResize(file: File, skipGifResize: boolean): boolean {
  return isSvg(file) || (skipGifResize && isGif(file));
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
}

/**
 * resizeImageFile이 이 파일을 거부할지(그리고 어떤 메시지로 거부할지) 실제 리사이즈를 실행하지
 * 않고 동기적으로 미리 판정한다. 파일 선택 즉시(업로드를 시도하기 전에) 크기를 검증할 때 쓴다 -
 * useImageAttachments.ts가 댓글 이미지 첨부 시점에 하는 것과 동일한 fail-fast 패턴.
 * 통과하면 null을 반환한다. resizeImageFile과 같은 기준(shouldSkipResize)을 공유해 둘이 어긋나지 않는다.
 */
export function getImageFileSizeError(
  file: File,
  { skipGifResize = true }: ResizeOptions = {}
): string | null {
  if (file.size > MAX_ORIGINAL_FILE_SIZE_BYTES) {
    return TEXTS.validation.imageTooLarge(MAX_ORIGINAL_FILE_SIZE_MB);
  }
  if (shouldSkipResize(file, skipGifResize) && file.size > MAX_UNRESIZABLE_FILE_SIZE_BYTES) {
    return TEXTS.validation.imageTooLarge(MAX_UNRESIZABLE_FILE_SIZE_MB);
  }
  return null;
}

/**
 * 업로드 전 이미지를 maxDimension 이하로 축소하고 webp로 재인코딩한다.
 *
 * 원본이 MAX_ORIGINAL_FILE_SIZE_MB를 넘으면 포맷과 무관하게 명시적으로 에러를 던진다. SVG,
 * 그리고 skipGifResize가 true일 때의 GIF는 리사이즈 없이 원본을 반환하되 MAX_UNRESIZABLE_FILE_SIZE_MB를
 * 넘으면 역시 에러를 던진다. 그 외에는 이미 충분히 작은 이미지를 원본 그대로 반환하고, 디코드
 * 실패·getContext 실패 등 어떤 이유로든 리사이즈 자체가 실패해도 예외를 던지지 않고 원본 File을
 * 반환한다 — 크기 상한만 지키면 업로드는 항상 성공해야 한다.
 */
export async function resizeImageFile(
  file: File,
  maxDimension: number,
  { skipGifResize = true }: ResizeOptions = {}
): Promise<File> {
  const sizeError = getImageFileSizeError(file, { skipGifResize });
  if (sizeError) {
    throw new UserFacingError(sizeError);
  }

  if (shouldSkipResize(file, skipGifResize)) {
    return file;
  }

  try {
    if (typeof createImageBitmap !== 'function') {
      return file;
    }
    const bitmap = await createImageBitmap(file);

    try {
      if (Math.max(bitmap.width, bitmap.height) <= maxDimension) {
        return file;
      }

      const scale = maxDimension / Math.max(bitmap.width, bitmap.height);
      const targetWidth = Math.round(bitmap.width * scale);
      const targetHeight = Math.round(bitmap.height * scale);

      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return file;
      }
      ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

      const blob = await canvasToWebpBlob(canvas);
      if (!blob) {
        return file;
      }

      const baseName = file.name.replace(/\.[^.]+$/, '') || 'image';
      return new File([blob], `${baseName}.webp`, { type: 'image/webp' });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}

/**
 * SVG의 루트 width/height가 없거나 퍼센트(예: mermaid.js의 width="100%")면 viewBox에서
 * 계산한 절대값으로 채워 넣는다. <img src="...">로 불러올 때 브라우저가 intrinsic 크기를
 * 못 구하면(퍼센트는 이 문맥에서 참조할 기준이 없음) 아예 렌더링되지 않는 문제가 있다 -
 * 인라인 SVG나 새 탭으로 직접 열 때는 문제없이 보이지만 <img> 태그로만 불러올 때 생긴다.
 */
export async function normalizeSvgDimensions(file: File): Promise<File> {
  if (!isSvg(file)) {
    return file;
  }

  try {
    const text = await file.text();
    const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
    const svgEl = doc.documentElement;
    if (svgEl.nodeName !== 'svg' || doc.querySelector('parsererror')) {
      return file;
    }

    const hasUsableWidth =
      svgEl.hasAttribute('width') && !svgEl.getAttribute('width')!.includes('%');
    const hasUsableHeight =
      svgEl.hasAttribute('height') && !svgEl.getAttribute('height')!.includes('%');
    if (hasUsableWidth && hasUsableHeight) {
      return file; // 이미 명시적 크기가 있으면 손대지 않는다.
    }

    const viewBox = svgEl.getAttribute('viewBox');
    if (!viewBox) {
      return file; // viewBox도 없으면 계산할 방법이 없다.
    }
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
      return file;
    }
    // parts.length === 4를 위에서 이미 확인했으므로 non-null 단언이 안전하다.
    const vbWidth = parts[2]!;
    const vbHeight = parts[3]!;
    if (vbWidth <= 0 || vbHeight <= 0) {
      return file;
    }

    svgEl.setAttribute('width', String(vbWidth));
    svgEl.setAttribute('height', String(vbHeight));

    const newSvgText = new XMLSerializer().serializeToString(doc);
    return new File([newSvgText], file.name, { type: SVG_MIME_TYPE });
  } catch {
    // 파싱 실패 등 어떤 이유로든 실패하면 원본 그대로 진행한다 - "크기 상한만 지키면
    // 업로드는 항상 성공해야 한다"는 이 파일의 기존 원칙(resizeImageFile)과 동일하게 맞춘다.
    return file;
  }
}
