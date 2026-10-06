import {
  ApiError,
  ImageUploadError,
  NetworkError,
  UserFacingError,
} from '@/shared/types/common.type';
import { TEXTS } from '@/shared/config/texts';

const SECONDS_PER_MINUTE = 60;

/**
 * 전역 에러 폴백(GlobalErrorFallback, RouteErrorBoundary, AsyncBoundary)이 공유하는
 * 에러 판별·메시지 결정 로직. 이미지 업로드 실패 안내(resolveImageUploadMessage)는 댓글 폼과
 * 프로필 수정이 함께 쓴다.
 *
 * 날것의 error.message는 절대 사용자에게 노출하지 않는다 - 브라우저의 영어 기술 문구나
 * 서버 내부 메시지가 그대로 보이게 된다. account.queries.ts / queryClient.ts와 동일한 규칙.
 */
export class ErrorUtil {
  /** 5xx 서버 에러 또는 네트워크 단절 여부를 판단 */
  static isServerError(error: unknown): boolean {
    if (error instanceof ApiError && error.status >= 500) {
      return true;
    }
    if (error instanceof NetworkError) {
      return true;
    }
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      return true;
    }
    return false;
  }

  /**
   * 이미지 업로드 단계 실패를 원인별 안내로 바꾼다. action은 그 폼의 제출 버튼 동작이다(댓글 등록은
   * register, 댓글 수정·프로필 사진은 save). 원인을 특정하지 못한 실패(failed)는 null - 호출부가
   * 자기 폼의 일반 실패 문구를 쓴다.
   */
  static resolveImageUploadMessage(
    error: ImageUploadError,
    action: 'register' | 'save'
  ): string | null {
    const texts = TEXTS.messages.error.uploadSubmit;

    if (error.reason === 'unsupportedType') {
      return texts.imageUnsupportedType;
    }

    if (error.reason === 'tooLarge') {
      return texts[action].imageTooLarge;
    }

    if (error.reason === 'rateLimited') {
      return error.retryAfterSeconds
        ? texts[action].imageRateLimitedIn(Math.ceil(error.retryAfterSeconds / SECONDS_PER_MINUTE))
        : texts[action].imageRateLimited;
    }

    if (error.reason === 'storageUnavailable') {
      return texts[action].storageUnavailable;
    }

    if (error.reason === 'network') {
      return texts[action].network;
    }

    return null;
  }

  /**
   * 새 배포 후 구 청크 파일 fetch 실패 여부를 판단
   * (dynamic import 실패 = "Failed to fetch dynamically imported module: ...")
   */
  static isChunkLoadError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }
    return (
      error.message.includes('Failed to fetch dynamically imported module') ||
      error.message.includes('Importing a module script failed') ||
      error.message.includes('error loading dynamically imported module')
    );
  }

  /**
   * 사용자에게 보여줄 메시지를 결정한다.
   * - ApiError: 서버 상세 메시지를 노출하지 않고 일반 메시지로 감싼다(보안·UX 정책)
   * - UserFacingError: 우리가 TEXTS로 작성한 사용자용 메시지이므로 그대로 노출
   * - 그 외: 예상치 못한 에러 - 날것의 message 대신 일반 안내 문구
   */
  static resolveMessage(error: unknown): string {
    if (error instanceof ApiError) {
      return TEXTS.messages.error.serverError;
    }
    if (error instanceof UserFacingError) {
      return error.message;
    }
    return TEXTS.errors.unexpected.description;
  }
}
