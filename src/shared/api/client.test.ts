import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/store/auth.store';
import { NavigationService } from '@/shared/lib/router/navigation';
import { AuthUtil } from '@/shared/utils/auth.util';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { ApiError } from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';

// NavigationService 모듈 전체를 mock — vi.spyOn 중첩 문제 방지
vi.mock('@/shared/lib/router/navigation', () => ({
  NavigationService: {
    navigate: vi.fn(),
    setNavigate: vi.fn(),
  },
}));

/**
 * MSW 핸들러 등록용 URL (API_BASE_URL prefix 포함)
 * - apiClient 내부에서 `this.baseURL + endpoint`로 URL을 조립하므로
 *   핸들러는 조립된 최종 URL과 일치해야 함
 */
const mswUrl = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const POST_ID = 'test-post-uuid';
/** apiClient.post()에 전달하는 경로 (baseURL 없음) */
const COMMENT_PATH = API_ENDPOINTS.post.postComment(POST_ID);
/** MSW 핸들러 등록 URL (baseURL 포함) */
const COMMENT_HANDLER_URL = mswUrl(COMMENT_PATH);
const REFRESH_HANDLER_URL = mswUrl(API_ENDPOINTS.auth.refresh);

const makeCommentFormData = () => {
  const fd = new FormData();
  fd.append('content', '테스트 댓글');
  return fd;
};

/** 401 에러 응답 바디 */
const make401 = (code: string) =>
  HttpResponse.json(
    { status: 401, code, message: 'unauthorized', timestamp: new Date().toISOString() },
    { status: 401 }
  );

/** 성공 댓글 응답 바디 */
const makeCommentSuccess = () =>
  HttpResponse.json(
    {
      status: 201,
      message: 'ok',
      data: { id: 'comment-uuid-1', content: '테스트 댓글' },
      timestamp: new Date().toISOString(),
    },
    { status: 201 }
  );

describe('ApiClient — 인증 오류 처리', () => {
  beforeEach(() => {
    vi.clearAllMocks(); // 각 테스트 전 mock 호출 기록 초기화
  });

  // Case 2~4가 각자 AuthUtil.clearAll()을 호출해 isLoggingOut() 유예 창을 연다 -
  // 다음 케이스로 새지 않도록 매번 비운다(auth.util.ts의 resetLogoutGuard 주석 참고).
  afterEach(() => {
    AuthUtil.resetLogoutGuard();
  });

  // ─────────────────────────────────────────────────────────────
  // Case 1: Access Token 만료 + Refresh 성공
  // ─────────────────────────────────────────────────────────────
  describe('Case 1: Access Token 만료 + Refresh Token 유효', () => {
    it('댓글 요청 → 401 TOKEN_EXPIRED → 토큰 갱신 → 원래 요청 재시도 성공', async () => {
      let commentCallCount = 0;

      server.use(
        // 첫 번째 댓글 POST → 401, 두 번째 → 성공
        http.post(COMMENT_HANDLER_URL, () => {
          commentCallCount++;
          return commentCallCount === 1 ? make401('TOKEN_EXPIRED') : makeCommentSuccess();
        }),
        // Refresh → 새 토큰 반환
        http.post(REFRESH_HANDLER_URL, () =>
          HttpResponse.json(
            {
              status: 200,
              message: 'ok',
              data: { accessToken: 'new-access-token' },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          )
        )
      );

      useAuthStore.getState().setAuth('expired-access-token');

      const result = await apiClient.post(COMMENT_PATH, makeCommentFormData());

      expect(commentCallCount).toBe(2); // 재시도 1회
      expect(useAuthStore.getState().accessToken).toBe('new-access-token');
      expect(result).toMatchObject({ id: 'comment-uuid-1' });
      expect(NavigationService.navigate).not.toHaveBeenCalled(); // 로그인 페이지로 이동 없음
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Case 1-1: 동시 다발 401 TOKEN_EXPIRED — refreshSubscribers 큐
  // ─────────────────────────────────────────────────────────────
  describe('Case 1-1: 동시에 두 요청이 401 TOKEN_EXPIRED', () => {
    it('refresh는 한 번만 호출되고, 두 요청 모두 새 토큰으로 재시도돼 성공한다', async () => {
      let refreshCallCount = 0;
      let commentCallCount = 0;

      server.use(
        // 최초 시도(동시 요청 각각 1회씩, 총 2회)는 401, 그 이후 재시도는 성공
        http.post(COMMENT_HANDLER_URL, () => {
          commentCallCount++;
          return commentCallCount <= 2 ? make401('TOKEN_EXPIRED') : makeCommentSuccess();
        }),
        http.post(REFRESH_HANDLER_URL, () => {
          refreshCallCount++;
          return HttpResponse.json(
            {
              status: 200,
              message: 'ok',
              data: { accessToken: 'new-access-token' },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        })
      );

      useAuthStore.getState().setAuth('expired-access-token');

      const [resultA, resultB] = await Promise.all([
        apiClient.post(COMMENT_PATH, makeCommentFormData()),
        apiClient.post(COMMENT_PATH, makeCommentFormData()),
      ]);

      // 큐(subscribeTokenRefresh)가 없으면 두 요청이 각자 refresh를 호출해 2가 된다.
      expect(refreshCallCount).toBe(1);
      expect(commentCallCount).toBe(4); // 최초 2회(둘 다 401) + 재시도 2회(둘 다 성공)
      expect(resultA).toMatchObject({ id: 'comment-uuid-1' });
      expect(resultB).toMatchObject({ id: 'comment-uuid-1' });
      expect(useAuthStore.getState().accessToken).toBe('new-access-token');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Case 1-2: refresh는 성공했지만 재시도한 요청도 다시 TOKEN_EXPIRED
  // (서버 시계 오차 등 회복 불가능한 상황) — 상한 없이 재귀하면 무한 루프
  // ─────────────────────────────────────────────────────────────
  describe('Case 1-2: refresh 성공 후 재시도한 요청도 다시 TOKEN_EXPIRED', () => {
    it('refresh를 다시 호출하지 않고 auth 초기화 + 로그인 페이지 이동으로 멈춘다', async () => {
      let refreshCallCount = 0;

      server.use(
        // 최초 요청도, 재시도도 항상 401 TOKEN_EXPIRED
        http.post(COMMENT_HANDLER_URL, () => make401('TOKEN_EXPIRED')),
        http.post(REFRESH_HANDLER_URL, () => {
          refreshCallCount++;
          return HttpResponse.json(
            {
              status: 200,
              message: 'ok',
              data: { accessToken: 'new-access-token' },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        })
      );

      useAuthStore.getState().setAuth('expired-access-token');

      // 요청은 영원히 pending — await하지 않고 side-effect만 검증
      apiClient.post(COMMENT_PATH, makeCommentFormData());

      await vi.waitFor(() => {
        expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.AUTH.LOGIN, {
          replace: true,
        });
      });

      // refresh는 1회만 — 재시도 후 다시 실패했다고 refresh를 또 호출하지 않는다
      expect(refreshCallCount).toBe(1);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Case 2: Access Token 만료 + Refresh Token도 만료
  // ─────────────────────────────────────────────────────────────
  describe('Case 2: Access Token 만료 + Refresh Token도 만료', () => {
    it('댓글 요청 → 401 TOKEN_EXPIRED → 갱신 실패 → auth 초기화 + 로그인 페이지 이동', async () => {
      server.use(
        http.post(COMMENT_HANDLER_URL, () => make401('TOKEN_EXPIRED')),
        http.post(REFRESH_HANDLER_URL, () => make401('INVALID_REFRESH_TOKEN'))
      );

      useAuthStore.getState().setAuth('expired-access-token');

      // 요청은 영원히 pending — await하지 않고 side-effect만 검증
      apiClient.post(COMMENT_PATH, makeCommentFormData());

      await vi.waitFor(() => {
        expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.AUTH.LOGIN, {
          replace: true,
        });
      });

      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Case 3: 토큰 없이 인증 필요 요청 (NOT_LOGGED_IN)
  // ─────────────────────────────────────────────────────────────
  describe('Case 3: 토큰 없음 (NOT_LOGGED_IN)', () => {
    it('댓글 요청 → 401 NOT_LOGGED_IN → auth 초기화 + 로그인 페이지 이동', async () => {
      server.use(http.post(COMMENT_HANDLER_URL, () => make401('NOT_LOGGED_IN')));

      // auth store는 비어있는 상태 (로그인 안 됨)
      // NOT_LOGGED_IN은 throw로 처리되므로 unhandled rejection 방지
      apiClient.post(COMMENT_PATH, makeCommentFormData()).catch(() => {});

      await vi.waitFor(() => {
        expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.AUTH.LOGIN, {
          replace: true,
        });
      });

      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Case 4: 유효하지 않은 토큰 (INVALID_TOKEN)
  // ─────────────────────────────────────────────────────────────
  describe('Case 4: 유효하지 않은 토큰 (INVALID_TOKEN)', () => {
    it('댓글 요청 → 401 INVALID_TOKEN → auth 초기화 + 로그인 페이지 이동', async () => {
      server.use(http.post(COMMENT_HANDLER_URL, () => make401('INVALID_TOKEN')));

      useAuthStore.getState().setAuth('malformed-token');

      // INVALID_TOKEN은 throw로 처리되므로 unhandled rejection 방지
      apiClient.post(COMMENT_PATH, makeCommentFormData()).catch(() => {});

      await vi.waitFor(() => {
        expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.AUTH.LOGIN, {
          replace: true,
        });
      });

      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Case 5: WAF가 앱 도달 전 차단 (403 + HTML, JSON 아님)
  // ─────────────────────────────────────────────────────────────
  describe('Case 5: CloudFront/WAF 차단 (403 + non-JSON)', () => {
    it('댓글 요청 → 403 + HTML 응답 → ApiError.code가 EDGE_BLOCKED로 설정된다', async () => {
      server.use(
        http.post(
          COMMENT_HANDLER_URL,
          () =>
            new HttpResponse(
              '<html><head><title>ERROR: The request could not be satisfied</title></head><body><h1>403 ERROR</h1>Request blocked.</body></html>',
              { status: 403, headers: { 'Content-Type': 'text/html' } }
            )
        )
      );

      useAuthStore.getState().setAuth('valid-access-token');

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toMatchObject({
        code: SERVER_ERROR_CODE.EDGE_BLOCKED,
        status: 403,
      });
    });

    it('우리 앱이 낸 403 JSON(ACCESS_DENIED)은 EDGE_BLOCKED로 바뀌지 않는다', async () => {
      server.use(
        http.post(
          COMMENT_HANDLER_URL,
          () =>
            new HttpResponse(
              JSON.stringify({
                status: 403,
                code: 'ACCESS_DENIED',
                message: 'forbidden',
                timestamp: new Date().toISOString(),
              }),
              { status: 403, headers: { 'Content-Type': 'application/json' } }
            )
        )
      );

      useAuthStore.getState().setAuth('valid-access-token');

      let caught: unknown;
      try {
        await apiClient.post(COMMENT_PATH, makeCommentFormData());
      } catch (e) {
        caught = e;
      }

      expect(caught).toBeInstanceOf(ApiError);
      expect((caught as ApiError).code).toBe('ACCESS_DENIED');
    });
  });
});
