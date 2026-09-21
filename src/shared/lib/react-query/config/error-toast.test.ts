import { afterEach, describe, expect, it } from 'vitest';
import { ApiError, type ApiErrorResponse } from '@/shared/types/common.type';
import { TEXTS } from '@/shared/config/texts';
import { LogoutGraceUtil } from '@/shared/utils/logout-grace.util';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import {
  resolveErrorToast,
  MUTATION_ERROR_POLICY,
  QUERY_ERROR_POLICY,
} from '@/shared/lib/react-query/config/error-toast';

const apiError = (overrides: Partial<ApiErrorResponse>): ApiError =>
  new ApiError({
    status: 500,
    code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR,
    message: 'boom',
    timestamp: '2026-09-22T00:00:00.000Z',
    ...overrides,
  });

afterEach(() => {
  LogoutGraceUtil.reset();
});

describe('resolveErrorToast', () => {
  it('manualErrorHandling이면 조용히 종료한다', () => {
    const error = apiError({ code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR });

    const decision = resolveErrorToast(error, { manualErrorHandling: true }, MUTATION_ERROR_POLICY);

    expect(decision).toEqual({ silent: true });
  });

  it('manualErrorHandling은 EDGE_BLOCKED보다 우선한다', () => {
    const error = apiError({ code: SERVER_ERROR_CODE.EDGE_BLOCKED });

    const decision = resolveErrorToast(error, { manualErrorHandling: true }, MUTATION_ERROR_POLICY);

    expect(decision).toEqual({ silent: true });
  });

  it('EDGE_BLOCKED는 meta.errorMessage보다 우선한다', () => {
    const error = apiError({ code: SERVER_ERROR_CODE.EDGE_BLOCKED });

    const decision = resolveErrorToast(
      error,
      { errorMessage: '게시글 등록에 실패했어요' },
      MUTATION_ERROR_POLICY
    );

    expect(decision).toEqual({ silent: false, message: TEXTS.messages.error.edgeBlocked });
  });

  it('meta.errorMessage가 있으면 그 메시지를 우선 사용한다', () => {
    const error = apiError({ code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR });

    const decision = resolveErrorToast(
      error,
      { errorMessage: '게시글 등록에 실패했어요' },
      MUTATION_ERROR_POLICY
    );

    expect(decision).toEqual({ silent: false, message: '게시글 등록에 실패했어요' });
  });

  it('로그아웃 유예 중인 401은 조용히 종료한다', () => {
    LogoutGraceUtil.markClearedAt();
    const error = apiError({ code: SERVER_ERROR_CODE.NOT_LOGGED_IN });

    const decision = resolveErrorToast(error, undefined, QUERY_ERROR_POLICY);

    expect(decision).toEqual({ silent: true });
  });

  it('로그아웃 유예 중인 401은 meta.errorMessage가 있어도 조용히 종료한다 (mutation)', () => {
    LogoutGraceUtil.markClearedAt();
    const error = apiError({ code: SERVER_ERROR_CODE.INVALID_TOKEN });

    const decision = resolveErrorToast(
      error,
      { errorMessage: '게시글 등록에 실패했어요' },
      MUTATION_ERROR_POLICY
    );

    expect(decision).toEqual({ silent: true });
  });

  it('유예 창 밖의 401은 loginRequired 토스트를 띄운다', () => {
    const error = apiError({ code: SERVER_ERROR_CODE.NOT_LOGGED_IN });

    const decision = resolveErrorToast(error, undefined, MUTATION_ERROR_POLICY);

    expect(decision).toEqual({ silent: false, message: TEXTS.messages.error.loginRequired });
  });

  it('403은 accessDenied 토스트를 띄운다', () => {
    const error = apiError({ code: SERVER_ERROR_CODE.ACCESS_DENIED });

    const decision = resolveErrorToast(error, undefined, MUTATION_ERROR_POLICY);

    expect(decision).toEqual({ silent: false, message: TEXTS.messages.error.accessDenied });
  });

  it('query 정책의 404는 조용히 종료한다 (ErrorBoundary가 소유)', () => {
    const error = apiError({ status: 404, code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR });

    const decision = resolveErrorToast(error, undefined, QUERY_ERROR_POLICY);

    expect(decision).toEqual({ silent: true });
  });

  it('mutation 정책의 404는 serverError 토스트를 띄운다', () => {
    const error = apiError({ status: 404, code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR });

    const decision = resolveErrorToast(error, undefined, MUTATION_ERROR_POLICY);

    expect(decision).toEqual({
      silent: false,
      message: TEXTS.messages.error.serverError,
      log: [`[API Mutation Error] ${error.message}`, error.data],
    });
  });

  it('그 외 ApiError는 serverError 토스트와 콘솔 로그를 남긴다', () => {
    const error = apiError({ status: 500, code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR });

    const decision = resolveErrorToast(error, undefined, QUERY_ERROR_POLICY);

    expect(decision).toEqual({
      silent: false,
      message: TEXTS.messages.error.serverError,
      log: [`[API Query Error] ${error.message}`, error.data],
    });
  });

  it('ApiError가 아닌 Error는 mutation 정책에서만 serverError 토스트를 띄운다', () => {
    const error = new TypeError('Failed to fetch');

    const mutationDecision = resolveErrorToast(error, undefined, MUTATION_ERROR_POLICY);
    const queryDecision = resolveErrorToast(error, undefined, QUERY_ERROR_POLICY);

    expect(mutationDecision).toEqual({
      silent: false,
      message: TEXTS.messages.error.serverError,
      log: [`[Mutation Error] ${error.message}`],
    });
    expect(queryDecision).toEqual({ silent: true });
  });

  it('Error가 아닌 값이 던져지면 mutation 정책은 unknownError로 폴백한다', () => {
    const decision = resolveErrorToast('boom', undefined, MUTATION_ERROR_POLICY);

    expect(decision).toEqual({ silent: false, message: TEXTS.messages.error.unknownError });
  });

  it('Error가 아닌 값이 던져지면 query 정책은 조용히 종료한다', () => {
    const decision = resolveErrorToast('boom', undefined, QUERY_ERROR_POLICY);

    expect(decision).toEqual({ silent: true });
  });
});
