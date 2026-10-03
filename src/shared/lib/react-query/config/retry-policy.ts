import { ApiError } from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';

/**
 * 쿼리 재시도 정책 - 실패 시 1회 재시도하되, 다시 보내도 같은 결과일 요청은 재시도하지 않는다:
 * 429(요청 한도 초과 - 재시도가 한도를 더 소모한다)와 EDGE_BLOCKED(WAF 차단 - 같은 요청은
 * 또 막힌다).
 */
export const shouldRetryQuery = (failureCount: number, error: unknown): boolean => {
  if (
    error instanceof ApiError &&
    (error.status === 429 || error.code === SERVER_ERROR_CODE.EDGE_BLOCKED)
  ) {
    return false;
  }

  return failureCount < 1;
};
