import { uploadApi } from '@/shared/api/upload.api';
import { resizeImageFile } from '@/shared/lib/image/resizeImage';

/**
 * 파일을 리사이즈한 뒤 스토리지에 직접 업로드하고 공개 URL을 반환한다
 * (백엔드는 서명 URL 발급만 담당). maxDimension은 용도별 상한(아바타 512, 댓글 이미지 1600).
 * 원본을 저장하지 않는 구조라 이 값이 곧 영구 화질 상한이다 - 라이트박스 확대 시 레티나에서도
 * 알아볼 수 있게 1024에서 상향했다.
 * options는 resizeImageFile로 그대로 전달한다(예: 아바타는 skipGifResize: false).
 */
export async function uploadImageAndGetUrl(
  file: File,
  maxDimension = 1600,
  options?: Parameters<typeof resizeImageFile>[2]
): Promise<string> {
  const resized = await resizeImageFile(file, maxDimension, options);
  const extension = resized.name.split('.').pop() || 'bin';
  const signed = await uploadApi.getSignedUploadUrl(extension);
  await uploadApi.uploadFileDirectly(signed, resized);
  return signed.publicUrl;
}
