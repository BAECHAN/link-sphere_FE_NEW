import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { ESTIMATED_IMAGE_URL_BYTES } from '@/entities/comment/config/comment.const';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import {
  ApiError,
  ImageUploadError,
  NetworkError,
  UserFacingError,
} from '@/shared/types/common.type';
import { ErrorUtil } from '@/shared/utils/error.util';

/** 어느 폼에서 난 실패인지 - 같은 코드라도 뜻이 달라진다(COMMENT_NOT_FOUND는 답글이면 부모, 수정이면 자기 자신) */
export type CommentSubmitMode = 'create' | 'reply' | 'update';

export class CommentUtil {
  /**
   * 본 요청(등록·수정)을 보냈지만 응답을 못 받은 실패 - 연결 끊김이나 CloudFront 504라 서버에는
   * 저장됐을 수 있다. 업로드 단계의 네트워크 실패는 ImageUploadError로 따로 오므로 여기 걸리지 않는다.
   */
  static isOutcomeUnknown(error: unknown): boolean {
    return error instanceof NetworkError || (error instanceof ApiError && error.status === 504);
  }

  /**
   * 댓글·답글 등록과 댓글 수정 실패를 원인별 안내 문구로 바꾼다(PostUtil.resolveSubmitError와 같은
   * 형태). 서버 message는 노출하지 않고 에러 타입·code·status로만 판정한다.
   */
  static resolveSubmitError(error: unknown, mode: CommentSubmitMode): string {
    const isUpdate = mode === 'update';
    const fallback = isUpdate
      ? TEXTS.messages.error.commentSubmit.updateFailed
      : TEXTS.messages.error.commentSubmit.createFailed;

    // 첨부 처리 중 우리가 직접 던진 안내(용량 초과 등) - 이미 TEXTS로 쓴 문구다
    if (error instanceof UserFacingError) {
      return error.message;
    }

    if (error instanceof ImageUploadError) {
      return ErrorUtil.resolveImageUploadMessage(error, isUpdate ? 'save' : 'register') ?? fallback;
    }

    // 등록은 그대로 다시 누르면 같은 댓글이 두 번 생길 수 있어 결과부터 확인하게 한다. 수정은 다시
    // 보내도 같은 내용으로 덮어쓸 뿐이라 일반 안내로 충분하다.
    if (CommentUtil.isOutcomeUnknown(error)) {
      if (!isUpdate) {
        return TEXTS.messages.error.commentSubmit.outcomeUnknown;
      }

      return error instanceof NetworkError
        ? TEXTS.messages.error.uploadSubmit.save.network
        : fallback;
    }

    if (!(error instanceof ApiError)) {
      return fallback;
    }

    // 댓글 API에는 앱 레이트리밋이 없어 Lambda 동시 실행 포화 등이다 - 업로드 한도(429)는 위에서
    // ImageUploadError로 따로 안내한다
    if (error.status === 429) {
      return TEXTS.messages.error.rateLimited;
    }

    if (error.code === SERVER_ERROR_CODE.EMAIL_NOT_VERIFIED) {
      return TEXTS.messages.error.emailVerificationRequired;
    }

    if (error.code === SERVER_ERROR_CODE.EDGE_BLOCKED) {
      return TEXTS.messages.error.edgeBlocked;
    }

    if (
      error.code === SERVER_ERROR_CODE.NOT_LOGGED_IN ||
      error.code === SERVER_ERROR_CODE.INVALID_TOKEN
    ) {
      return TEXTS.messages.error.loginRequired;
    }

    if (error.code === SERVER_ERROR_CODE.ACCESS_DENIED) {
      return TEXTS.messages.error.accessDenied;
    }

    if (!isUpdate && error.code === SERVER_ERROR_CODE.POST_NOT_FOUND) {
      return TEXTS.messages.error.commentSubmit.postDeleted;
    }

    if (mode === 'reply' && error.code === SERVER_ERROR_CODE.COMMENT_NOT_FOUND) {
      return TEXTS.messages.error.commentSubmit.parentDeleted;
    }

    if (
      isUpdate &&
      (error.code === SERVER_ERROR_CODE.COMMENT_NOT_FOUND ||
        error.code === SERVER_ERROR_CODE.COMMENT_DELETED)
    ) {
      return TEXTS.messages.error.commentSubmit.commentDeleted;
    }

    return fallback;
  }

  /**
   * 댓글 등록/수정 요청이 실제로 전송할 JSON 바디와 같은 모양을 만들어 그 UTF-8 바이트를
   * 잰다. content만 보는 MAX_COMMENT_CONTENT_BYTES 체크와 달리, 줄바꿈 등 JSON 이스케이프
   * 오버헤드와 이미지 URL 기여분까지 포함한 실제 전송량에 가깝다 - 이걸 손으로 계산(개행 개수
   * 세기, 배열 문법 바이트 계산)하는 대신 진짜 JSON.stringify 결과를 재는 쪽이 정확하고 유지보수하기 쉽다.
   *
   * pendingImageCount(File[], 아직 업로드 전)는 실제 URL을 알 수 없으므로
   * ESTIMATED_IMAGE_URL_BYTES 길이의 자리표시자 문자열로 대신한다.
   */
  static estimateCommentPayloadBytes(
    content: string,
    existingImageUrls: string[],
    pendingImageCount: number
  ): number {
    const placeholders = Array.from({ length: pendingImageCount }, () =>
      'x'.repeat(ESTIMATED_IMAGE_URL_BYTES)
    );
    const images = [...existingImageUrls, ...placeholders];
    return getUtf8ByteLength(JSON.stringify({ content, images }));
  }
}
