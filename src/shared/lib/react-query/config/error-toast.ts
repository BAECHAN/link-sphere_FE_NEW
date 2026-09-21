import { ApiError } from '@/shared/types/common.type';
import { TEXTS } from '@/shared/config/texts';
import { LogoutGraceUtil } from '@/shared/utils/logout-grace.util';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';

export interface CustomMutationMeta {
  successMessage?: string;
  errorMessage?: string;
  manualErrorHandling?: boolean;
}

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: CustomMutationMeta;
    queryMeta: CustomMutationMeta;
  }
}

/** 전역 에러 토스트를 띄울지, 띄운다면 어떤 문구로 띄울지에 대한 판정 결과. */
export type ErrorToastDecision =
  | { silent: true }
  | { silent: false; message: string; log?: readonly unknown[] };

/** mutation과 query가 의도적으로 다르게 처리하는 지점만 모은 정책. 나머지 판정은 양쪽 동일하다. */
export interface ErrorToastPolicy {
  /** 404를 조용히 넘길지. query만 true — 삭제·비공개 글 안내는 화면의 ErrorBoundary가 소유한다. */
  skipNotFound: boolean;
  /** ApiError가 아닌 에러(네트워크 단절 등)에 토스트를 띄울지. mutation만 true. */
  toastOnNonApiError: boolean;
  /** console.error 접두사에 들어갈 이름. */
  logLabel: 'Mutation' | 'Query';
  /** 어느 분기에도 안 걸린 값(문자열 throw 등)에 띄울 토스트. null이면 조용히 종료. */
  fallbackMessage: string | null;
}

export const MUTATION_ERROR_POLICY: ErrorToastPolicy = {
  skipNotFound: false,
  toastOnNonApiError: true,
  logLabel: 'Mutation',
  fallbackMessage: TEXTS.messages.error.unknownError,
};

export const QUERY_ERROR_POLICY: ErrorToastPolicy = {
  skipNotFound: true,
  toastOnNonApiError: false,
  logLabel: 'Query',
  fallbackMessage: null,
};

const isSessionInvalidCode = (code: string): boolean => {
  return code === SERVER_ERROR_CODE.NOT_LOGGED_IN || code === SERVER_ERROR_CODE.INVALID_TOKEN;
};

/**
 * mutation/query 전역 에러 핸들러가 공유하는 판정 로직. 토스트를 직접 띄우지 않고
 * 결정만 반환한다 — 호출부(queryClient.ts)가 실제 toast.error 호출을 소유한다.
 */
export function resolveErrorToast(
  error: unknown,
  meta: CustomMutationMeta | undefined,
  policy: ErrorToastPolicy
): ErrorToastDecision {
  if (meta?.manualErrorHandling) {
    return { silent: true };
  }

  // 로그아웃 처리 중(clearQueries의 배경 재요청) 온 401은 세션 만료가 아니라 레이스이므로
  // meta의 커스텀 에러 메시지보다 먼저 걸러 어떤 토스트도 뜨지 않게 한다.
  if (
    error instanceof ApiError &&
    isSessionInvalidCode(error.code) &&
    LogoutGraceUtil.isLoggingOut()
  ) {
    return { silent: true };
  }

  // 보안 정책(CloudFront/WAF)에 앱 도달 전 차단된 경우 - meta의 커스텀 에러 메시지보다
  // 먼저 처리한다. 그러지 않으면 게시글 등록처럼 errorMessage를 쓰는 mutation은 이 원인을
  // "게시글 등록에 실패했어요" 같은 일반 메시지로 덮어써 사용자가 실제 원인을 알 수 없다.
  if (error instanceof ApiError && error.code === SERVER_ERROR_CODE.EDGE_BLOCKED) {
    return { silent: false, message: TEXTS.messages.error.edgeBlocked };
  }

  if (meta?.errorMessage) {
    return { silent: false, message: meta.errorMessage };
  }

  if (error instanceof ApiError) {
    if (isSessionInvalidCode(error.code)) {
      // 세션 정리(clearAll)는 client.ts의 401 인터셉터가 이미 수행했다 - 여기서는
      // 토스트만 띄운다(토스트 단일 소유 원칙, client.ts:218 주석 참고).
      return { silent: false, message: TEXTS.messages.error.loginRequired };
    }

    if (error.code === SERVER_ERROR_CODE.ACCESS_DENIED) {
      return { silent: false, message: TEXTS.messages.error.accessDenied };
    }

    if (policy.skipNotFound && error.status === 404) {
      // 404는 서버 장애가 아니라 화면이 처리해야 할 도메인 상태다(삭제·비공개 글 등).
      // 전역 토스트 대신 각 화면의 ErrorBoundary가 안내를 소유한다.
      return { silent: true };
    }

    // 보안 및 UX를 위해 서버 에러 메시지를 직접 노출하지 않음
    // 상세 에러는 콘솔에 남기고 사용자에게는 일반적인 에러 메시지 표시
    return {
      silent: false,
      message: TEXTS.messages.error.serverError,
      log: [`[API ${policy.logLabel} Error] ${error.message}`, error.data],
    };
  }

  if (policy.toastOnNonApiError && error instanceof Error) {
    return {
      silent: false,
      message: TEXTS.messages.error.serverError,
      log: [`[${policy.logLabel} Error] ${error.message}`],
    };
  }

  if (policy.fallbackMessage === null) {
    return { silent: true };
  }

  return { silent: false, message: policy.fallbackMessage };
}
