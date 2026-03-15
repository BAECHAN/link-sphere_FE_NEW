import { describe, it, expect, vi, beforeEach } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/store/auth.store';
import { NavigationService } from '@/shared/lib/router/navigation';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

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
      apiClient.post(COMMENT_PATH, makeCommentFormData());

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

      apiClient.post(COMMENT_PATH, makeCommentFormData());

      await vi.waitFor(() => {
        expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.AUTH.LOGIN, {
          replace: true,
        });
      });

      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });
});
