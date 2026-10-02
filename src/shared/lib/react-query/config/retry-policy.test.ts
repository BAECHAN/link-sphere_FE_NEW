import { describe, expect, it } from 'vitest';
import { ApiError, type ApiErrorResponse } from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { shouldRetryQuery } from '@/shared/lib/react-query/config/retry-policy';

const apiError = (overrides: Partial<ApiErrorResponse>): ApiError =>
  new ApiError({
    status: 500,
    code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR,
    message: 'boom',
    timestamp: '2026-10-02T00:00:00.000Z',
    ...overrides,
  });

describe('shouldRetryQuery', () => {
  it('일반 실패는 1회만 재시도한다', () => {
    const error = apiError({ status: 500 });

    expect(shouldRetryQuery(0, error)).toBe(true);
    expect(shouldRetryQuery(1, error)).toBe(false);
  });

  it('429는 재시도하지 않는다', () => {
    expect(shouldRetryQuery(0, apiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED' }))).toBe(false);
  });

  it('EDGE_BLOCKED(WAF 차단)는 재시도하지 않는다', () => {
    expect(
      shouldRetryQuery(0, apiError({ status: 403, code: SERVER_ERROR_CODE.EDGE_BLOCKED }))
    ).toBe(false);
  });

  it('ApiError가 아닌 실패(네트워크 단절 등)는 1회 재시도한다', () => {
    expect(shouldRetryQuery(0, new TypeError('Failed to fetch'))).toBe(true);
  });
});
