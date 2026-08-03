import { TEXTS } from '@/shared/config/texts';

const SKIP_EXTENSIONS = ['gif', 'svg'];
const SKIP_MIME_TYPES = ['image/gif', 'image/svg+xml'];
const WEBP_QUALITY = 0.85;
// Supabase 버킷 업로드 용량 제한과 동일 (useImagePaste.ts의 MAX_IMAGE_SIZE_MB 참고)
const MAX_UNRESIZABLE_FILE_SIZE_MB = 10;
const MAX_UNRESIZABLE_FILE_SIZE_BYTES = MAX_UNRESIZABLE_FILE_SIZE_MB * 1024 * 1024;

function shouldSkipResize(file: File): boolean {
  if (SKIP_MIME_TYPES.includes(file.type)) {
    return true;
  }
  const extension = file.name.split('.').pop()?.toLowerCase();
  return !!extension && SKIP_EXTENSIONS.includes(extension);
}

function canvasToWebpBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/webp', WEBP_QUALITY));
}

/**
 * 업로드 전 이미지를 maxDimension 이하로 축소하고 webp로 재인코딩한다.
 *
 * 애니메이션이 깨지는 GIF, 래스터화하면 안 되는 SVG, 이미 충분히 작은 이미지는
 * 원본 그대로 반환한다. 디코드 실패·getContext 실패 등 어떤 이유로든 리사이즈에
 * 실패해도 예외를 던지지 않고 원본 File을 반환한다 — 업로드 자체는 항상 성공해야 한다.
 */
export async function resizeImageFile(file: File, maxDimension: number): Promise<File> {
  if (shouldSkipResize(file)) {
    if (file.size > MAX_UNRESIZABLE_FILE_SIZE_BYTES) {
      throw new Error(TEXTS.validation.imageTooLarge(MAX_UNRESIZABLE_FILE_SIZE_MB));
    }
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
