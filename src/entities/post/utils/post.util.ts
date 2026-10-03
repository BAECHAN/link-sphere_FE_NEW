import { ApiError } from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { TEXTS } from '@/shared/config/texts';
import { ErrorUtil } from '@/shared/utils/error.util';

/** 등록·수정 중 어느 쪽에서 난 실패인지 - 같은 코드라도 뜻이 달라지는 경우가 있다(FORBIDDEN 등). */
export interface PostSubmitErrorContext {
  mode: 'create' | 'update';
  /** 등록 시 북마크 폴더를 골랐는지 - 골랐을 때의 FORBIDDEN은 "남의 폴더"다 */
  hasFolders: boolean;
}

/**
 * 실패를 어디에 보여줄지의 판정 결과.
 * - field: 사용자가 그 입력칸을 고치면 해결된다 → 입력칸 아래 에러(form.setError)
 * - form: 입력칸과 무관하다 → 버튼 위 안내(FormAlert). checkFeed면 "피드에서 확인하기" 링크를 붙인다
 */
export type PostSubmitErrorResolution =
  | { kind: 'field'; field: 'url' | 'folderIds'; message: string }
  | { kind: 'form'; message: string; action?: 'checkFeed' };

const URL_FIELD_MESSAGES: Partial<Record<string, string>> = {
  [SERVER_ERROR_CODE.URL_UNRESOLVABLE]: TEXTS.messages.error.postSubmit.urlUnresolvable,
  [SERVER_ERROR_CODE.URL_NOT_ALLOWED]: TEXTS.messages.error.postSubmit.urlNotAllowed,
  [SERVER_ERROR_CODE.INVALID_URL]: TEXTS.messages.error.postSubmit.urlInvalid,
  [SERVER_ERROR_CODE.INVALID_INPUT]: TEXTS.messages.error.postSubmit.urlInvalid,
};

const SECONDS_PER_MINUTE = 60;

export class PostUtil {
  /**
   * 게시글 등록·수정 실패를 "고칠 수 있는 입력칸" 또는 "폼 전체 안내"로 분류한다. 서버 message는
   * 영어·내부 문구라 그대로 노출하지 않고 code·status로만 판정한다(error.util.ts와 같은 규칙).
   */
  static resolveSubmitError(
    error: unknown,
    context: PostSubmitErrorContext
  ): PostSubmitErrorResolution {
    const fallback =
      context.mode === 'create'
        ? TEXTS.messages.error.postSubmit.createFailed
        : TEXTS.messages.error.postSubmit.updateFailed;

    if (!(error instanceof ApiError)) {
      return {
        kind: 'form',
        message: ErrorUtil.isServerError(error)
          ? TEXTS.messages.error.postSubmit.network
          : fallback,
      };
    }

    const urlMessage = URL_FIELD_MESSAGES[error.code];

    if (urlMessage) {
      return { kind: 'field', field: 'url', message: urlMessage };
    }

    const isFolderMissing =
      error.code === SERVER_ERROR_CODE.FOLDER_NOT_FOUND ||
      (context.mode === 'create' &&
        context.hasFolders &&
        error.code === SERVER_ERROR_CODE.FORBIDDEN);

    if (isFolderMissing) {
      return {
        kind: 'field',
        field: 'folderIds',
        message: TEXTS.messages.error.postSubmit.folderNotFound,
      };
    }

    if (error.status === 429) {
      return {
        kind: 'form',
        message: error.retryAfterSeconds
          ? TEXTS.messages.error.postSubmit.rateLimitedIn(
              Math.ceil(error.retryAfterSeconds / SECONDS_PER_MINUTE)
            )
          : TEXTS.messages.error.postSubmit.rateLimited,
      };
    }

    // 504는 CloudFront가 기다림을 끊은 것이라 서버에서는 저장이 끝났을 수 있다 - 그대로 다시 누르면
    // 같은 글이 두 번 생긴다(posts.url에 중복 제약 없음). 피드부터 확인하게 한다.
    if (error.status === 504) {
      return {
        kind: 'form',
        message: TEXTS.messages.error.postSubmit.timeout,
        action: 'checkFeed',
      };
    }

    if (error.code === SERVER_ERROR_CODE.EMAIL_NOT_VERIFIED) {
      return { kind: 'form', message: TEXTS.messages.error.emailVerificationRequired };
    }

    if (error.code === SERVER_ERROR_CODE.EDGE_BLOCKED) {
      return { kind: 'form', message: TEXTS.messages.error.edgeBlocked };
    }

    if (
      error.code === SERVER_ERROR_CODE.NOT_LOGGED_IN ||
      error.code === SERVER_ERROR_CODE.INVALID_TOKEN
    ) {
      return { kind: 'form', message: TEXTS.messages.error.loginRequired };
    }

    if (context.mode === 'update' && error.code === SERVER_ERROR_CODE.POST_NOT_FOUND) {
      return { kind: 'form', message: TEXTS.messages.error.postSubmit.postDeleted };
    }

    if (context.mode === 'update' && error.code === SERVER_ERROR_CODE.FORBIDDEN) {
      return { kind: 'form', message: TEXTS.messages.error.postSubmit.notOwner };
    }

    return { kind: 'form', message: fallback };
  }
}
