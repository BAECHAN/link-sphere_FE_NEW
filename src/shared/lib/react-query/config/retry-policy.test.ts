import { describe, expect, it } from 'vitest';
import {
  ApiError,
  NetworkError,
  SessionChangedError,
  SessionExpiredError,
  type ApiErrorResponse,
} from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import {
  shouldRetryIdempotentMutation,
  shouldRetryQuery,
} from '@/shared/lib/react-query/config/retry-policy';

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

  it('SessionChangedError(보낸 뒤 인증 세대가 바뀜)는 재시도하지 않는다', () => {
    expect(shouldRetryQuery(0, new SessionChangedError())).toBe(false);
  });

  it('SessionExpiredError(로그인 만료로 처리하지 못함)는 재시도하지 않는다', () => {
    expect(shouldRetryQuery(0, new SessionExpiredError())).toBe(false);
  });
});

describe('shouldRetryIdempotentMutation', () => {
  it('응답을 못 받은 실패(연결 끊김·504)는 1회만 다시 보낸다', () => {
    expect(shouldRetryIdempotentMutation(0, new NetworkError())).toBe(true);
    expect(shouldRetryIdempotentMutation(0, apiError({ status: 504 }))).toBe(true);
    expect(shouldRetryIdempotentMutation(1, new NetworkError())).toBe(false);
  });

  it('서버가 답한 실패와 세션 실패는 다시 보내지 않는다', () => {
    expect(shouldRetryIdempotentMutation(0, apiError({ status: 500 }))).toBe(false);
    expect(shouldRetryIdempotentMutation(0, apiError({ status: 429 }))).toBe(false);
    expect(shouldRetryIdempotentMutation(0, new SessionChangedError())).toBe(false);
    expect(shouldRetryIdempotentMutation(0, new SessionExpiredError())).toBe(false);
  });
});
