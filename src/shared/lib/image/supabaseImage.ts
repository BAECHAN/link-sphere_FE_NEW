const OBJECT_PUBLIC_PATH = '/storage/v1/object/public/';
const RENDER_PUBLIC_PATH = '/storage/v1/render/image/public/';

interface TransformOptions {
  width: number;
  height?: number;
  resize?: 'cover' | 'contain' | 'fill';
  quality?: number;
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
  if (!url.includes(OBJECT_PUBLIC_PATH)) {
    return url;
  }
  if (/\.svg(\?.*)?$/i.test(url)) {
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
