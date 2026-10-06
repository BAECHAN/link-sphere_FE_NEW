import { uploadApi } from '@/shared/api/upload.api';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import { getUploadExtension } from '@/shared/lib/image/imageFormat';
import { resizeImageFile } from '@/shared/lib/image/resizeImage';
import {
  ApiError,
  ImageUploadError,
  NetworkError,
  UserFacingError,
} from '@/shared/types/common.type';

// 서명 URL 발급·스토리지 PUT 실패를 ImageUploadError로 모은다 - 본 요청(댓글 등록 등)의 실패와
// 구분해야 같은 429·네트워크라도 알맞은 안내를 고를 수 있다. 서명 URL의 5xx도 여기서 바꾼다 - 그대로
// 두면 504가 "본 요청이 저장됐는지 모름"으로 읽힌다. 로그인 만료·보안 정책 차단처럼 단계와 무관하게
// 뜻이 같은 ApiError는 그대로 둔다.
function toImageUploadError(error: unknown): unknown {
  if (error instanceof NetworkError) {
    return new ImageUploadError('network');
  }

  if (!(error instanceof ApiError)) {
    return error;
  }

  if (error.code === SERVER_ERROR_CODE.UNSUPPORTED_IMAGE_TYPE) {
    return new ImageUploadError('unsupportedType');
  }

  if (error.status === 429) {
    return new ImageUploadError('rateLimited', error.retryAfterSeconds);
  }

  if (error.status >= 500) {
    return new ImageUploadError('failed');
  }

  return error;
}

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
  const extension = getUploadExtension(resized.type);

  // 첨부·아바타 선택 단계에서 이미 허용 형식만 받으므로 정상 경로에서는 걸리지 않는다 - 타입 좁히기용
  if (!extension) {
    throw new UserFacingError(TEXTS.validation.imageFileOnly);
  }

  try {
    const signed = await uploadApi.getSignedUploadUrl(extension);
    await uploadApi.uploadFileDirectly(signed, resized);
    return signed.publicUrl;
  } catch (error) {
    throw toImageUploadError(error);
  }
}
