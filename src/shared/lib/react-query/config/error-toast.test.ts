import { afterEach, describe, expect, it } from 'vitest';
import {
  ApiError,
  SessionChangedError,
  SessionExpiredError,
  type ApiErrorResponse,
} from '@/shared/types/common.type';
import { TEXTS } from '@/shared/config/texts';
import { LogoutGraceUtil } from '@/shared/utils/logout-grace.util';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { useAuthStore } from '@/shared/store/auth.store';
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

    expect(decision).toMatchObject({ silent: false, message: TEXTS.messages.error.edgeBlocked });
  });

  it('429는 meta.errorMessage보다 우선해 rateLimited 토스트를 띄운다', () => {
    const error = apiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED' });

    const decision = resolveErrorToast(
      error,
      { errorMessage: '게시글 등록에 실패했어요.' },
      MUTATION_ERROR_POLICY
    );

    expect(decision).toMatchObject({ silent: false, message: TEXTS.messages.error.rateLimited });
  });

  it('앱 에러 코드가 없는 429(Lambda 동시 실행 포화)도 rateLimited 토스트를 띄운다', () => {
    const error = apiError({ status: 429, code: '429' });

    const decision = resolveErrorToast(error, undefined, QUERY_ERROR_POLICY);

    expect(decision).toMatchObject({ silent: false, message: TEXTS.messages.error.rateLimited });
  });

  it('429·EDGE_BLOCKED 안내는 원인별 고정 id를 달아 동시에 여러 요청이 실패해도 하나로 합쳐진다', () => {
    const rateLimitedByQuery = resolveErrorToast(
      apiError({ status: 429, code: '429' }),
      undefined,
      QUERY_ERROR_POLICY
    );
    const rateLimitedByMutation = resolveErrorToast(
      apiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED' }),
      undefined,
      MUTATION_ERROR_POLICY
    );
    const edgeBlocked = resolveErrorToast(
      apiError({ code: SERVER_ERROR_CODE.EDGE_BLOCKED }),
      undefined,
      QUERY_ERROR_POLICY
    );

    const idOf = (decision: ReturnType<typeof resolveErrorToast>) =>
      decision.silent ? undefined : decision.id;

    // 조회·등록 어느 쪽에서 나든 같은 id - 원인이 다르면 다른 id(서로 덮어쓰지 않게)
    expect(idOf(rateLimitedByQuery)).toBeDefined();
    expect(idOf(rateLimitedByQuery)).toBe(idOf(rateLimitedByMutation));
    expect(idOf(edgeBlocked)).toBeDefined();
    expect(idOf(edgeBlocked)).not.toBe(idOf(rateLimitedByQuery));
  });

  it('그 밖의 서버 에러는 id 없이 매번 띄운다', () => {
    const decision = resolveErrorToast(
      apiError({ code: SERVER_ERROR_CODE.INTERNAL_SERVER_ERROR }),
      undefined,
      QUERY_ERROR_POLICY
    );

    expect(decision).not.toHaveProperty('id');
  });

  it('manualErrorHandling은 429보다 우선한다', () => {
    const error = apiError({ status: 429, code: 'RATE_LIMIT_EXCEEDED' });

    const decision = resolveErrorToast(error, { manualErrorHandling: true }, MUTATION_ERROR_POLICY);

    expect(decision).toEqual({ silent: true });
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

  it('로그인이 풀린 채 그 화면에 머무는 동안의 401은 meta.errorMessage가 있어도 조용히 종료한다', () => {
    // 다시 로그인하라는 안내는 로그인 창·만료 토스트가 이미 맡고 있다(auth.store signedOutInPlace)
    useAuthStore.getState().expireSession('/post/submit');
    const error = apiError({ code: SERVER_ERROR_CODE.NOT_LOGGED_IN });

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

  describe('SessionChangedError (보낸 뒤 인증 세대가 바뀜)', () => {
    it('mutation은 meta.errorMessage보다 우선해 sessionChanged 토스트를 띄운다', () => {
      const decision = resolveErrorToast(
        new SessionChangedError(),
        { errorMessage: '좋아요에 실패했어요.' },
        MUTATION_ERROR_POLICY
      );

      expect(decision).toEqual({ silent: false, message: TEXTS.messages.error.sessionChanged });
    });

    it('query는 meta.errorMessage가 있어도 조용히 종료한다', () => {
      const decision = resolveErrorToast(
        new SessionChangedError(),
        { errorMessage: '목록을 불러오지 못했어요.' },
        QUERY_ERROR_POLICY
      );

      expect(decision).toEqual({ silent: true });
    });

    it('로그아웃 유예 중이면 mutation도 조용히 종료한다', () => {
      LogoutGraceUtil.markClearedAt();

      const decision = resolveErrorToast(
        new SessionChangedError(),
        undefined,
        MUTATION_ERROR_POLICY
      );

      expect(decision).toEqual({ silent: true });
    });

    it('manualErrorHandling이 우선한다', () => {
      const decision = resolveErrorToast(
        new SessionChangedError(),
        { manualErrorHandling: true },
        MUTATION_ERROR_POLICY
      );

      expect(decision).toEqual({ silent: true });
    });
  });

  // 안내는 만료 정리가 맡는다 - ApiError가 아니라 유예 창(LogoutGraceUtil) 판정과 상관없이 조용해야 한다
  describe('SessionExpiredError (로그인 만료로 처리하지 못함)', () => {
    it('mutation은 meta.errorMessage가 있어도 조용히 종료한다', () => {
      const decision = resolveErrorToast(
        new SessionExpiredError(),
        { errorMessage: '좋아요에 실패했어요.' },
        MUTATION_ERROR_POLICY
      );

      expect(decision).toEqual({ silent: true });
    });

    it('query도 조용히 종료한다', () => {
      const decision = resolveErrorToast(
        new SessionExpiredError(),
        { errorMessage: '목록을 불러오지 못했어요.' },
        QUERY_ERROR_POLICY
      );

      expect(decision).toEqual({ silent: true });
    });
  });
});
