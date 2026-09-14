const OBJECT_PUBLIC_PATH = '/storage/v1/object/public/';
const RENDER_PUBLIC_PATH = '/storage/v1/render/image/public/';

interface TransformOptions {
  width: number;
  height?: number;
  resize?: 'cover' | 'contain' | 'fill';
  quality?: number;
}

/**
 * 이 URL이 Supabase 이미지 변환 엔드포인트를 타는지 판별한다. 변환을 타면 width와
 * height를 같은 값으로 요청했을 때(resize=cover) 응답이 항상 정확히 그 정사각으로
 * 잘려 오므로(원본이 그 값보다 작지만 않으면), 호출부가 로드 전에 정사각 자리를
 * 미리 예약할 수 있다. blob:(업로드 전 미리보기)·외부 이미지·svg는 원본을 그대로
 * 쓰므로 비율을 알 수 없다.
 */
export function isTransformableImageUrl(url: string | null | undefined): boolean {
  if (!url) {
    return false;
  }
  if (!url.includes(OBJECT_PUBLIC_PATH)) {
    return false;
  }
  return !/\.svg(\?.*)?$/i.test(url);
}

/**
 * Supabase Storage 공개 URL을 이미지 변환 엔드포인트 URL로 바꾼다.
 * 원본을 그대로 내려주는 /object/public/ 경로를, 지정한 크기로 리사이즈해주는
 * /render/image/public/ 경로로 치환한다. webp 협상은 브라우저 Accept 헤더로 자동 처리되므로
 * format 파라미터는 넣지 않는다.
 *
 * Supabase 대상이 아니거나(blob:, data:, 외부 OG 이미지 등) 변환 대상이 아닌 포맷(svg)이면
 * 원본 문자열을 그대로 반환한다.
 */
export function getTransformedImageUrl(
  url: string | null | undefined,
  { width, height = width, resize = 'cover', quality = 80 }: TransformOptions
): string {
  if (!url) {
    return '';
  }
  if (!isTransformableImageUrl(url)) {
    return url;
  }

  const transformed = url.replace(OBJECT_PUBLIC_PATH, RENDER_PUBLIC_PATH);
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    resize,
    quality: String(quality),
  });
  const separator = transformed.includes('?') ? '&' : '?';
  return `${transformed}${separator}${params.toString()}`;
}
