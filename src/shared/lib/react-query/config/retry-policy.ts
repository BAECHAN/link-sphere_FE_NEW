import { ApiError, SessionChangedError, SessionExpiredError } from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { ErrorUtil } from '@/shared/utils/error.util';

/**
 * 쿼리 재시도 정책 - 실패 시 1회 재시도하되, 다시 보내도 같은 결과일 요청은 재시도하지 않는다:
 * 429(요청 한도 초과 - 재시도가 한도를 더 소모한다), EDGE_BLOCKED(WAF 차단 - 같은 요청은
 * 또 막힌다), SessionChangedError(보낸 뒤 인증 세대가 바뀜 - 새 인증으로 다시 부르는 건
 * useAuthEpochSync의 몫이다), SessionExpiredError(로그인 만료 - 다시 보내도 토큰이 없다).
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (error instanceof SessionChangedError || error instanceof SessionExpiredError) {
    return false;
  }

  if (
    error instanceof ApiError &&
    (error.status === 429 || error.code === SERVER_ERROR_CODE.EDGE_BLOCKED)
  ) {
    return false;
  }

  return failureCount < 1;
};

/**
 * 삭제처럼 몇 번 보내도 결과가 같은 mutation의 재시도 정책 - 응답을 못 받았을 때만 1회 더 보내 결과를 확인한다.
 * 서버가 실패라고 답했으면 다시 보내지 않는다. 등록처럼 다시 보내면 결과가 늘어나는 요청에는 쓰지 않는다.
 * 근거는 RFC 9110 §9.2.2(멱등 메서드는 응답을 읽기 전에 끊기면 자동으로 반복할 수 있다, docs/POST.md "삭제").
 */
export const shouldRetryIdempotentMutation = (failureCount: number, error: unknown): boolean => {
  return failureCount < 1 && ErrorUtil.isOutcomeUnknown(error);
};
