import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/store/auth.store';
import { NavigationService } from '@/shared/lib/router/navigation';
import { AuthUtil } from '@/shared/utils/auth.util';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { ApiError, NetworkError, SessionChangedError } from '@/shared/types/common.type';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';
import { LocalStorageUtil } from '@/shared/utils/storage.util';

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
  // Case 1-3: refresh가 끝난 뒤에 늦게 도착한 401 TOKEN_EXPIRED
  // 리더의 finally는 재시도 완료를 기다리지 않고 isRefreshing을 내리므로, 늦게 온 401은
  // 큐가 아니라 리더 경로로 들어온다. BE는 refresh마다 세션을 회전(이전 행 폐기)하므로
  // 여기서 refresh를 또 부르면, 첫 refresh 토큰으로 재시도 중이던 요청이 만료된다.
  // ─────────────────────────────────────────────────────────────
  describe('Case 1-3: refresh가 끝난 뒤 늦게 도착한 401 TOKEN_EXPIRED', () => {
    it('refresh를 다시 부르지 않고 이미 갱신된 토큰으로 재시도해, 두 요청 모두 성공한다', async () => {
      const EXPIRED_TOKEN = 'expired-access-token';
      const ACCOUNT_HANDLER_URL = mswUrl(API_ENDPOINTS.auth.account);
      let refreshCallCount = 0;
      // BE처럼 refresh마다 토큰을 회전시키고, 가장 최근에 발급한 토큰만 유효하다고 판정한다
      let validToken: string | null = null;

      // 응답 순서를 강제하는 게이트 - 실제로는 서버 응답 시간 편차(콜드스타트 등)로 생긴다
      let markCommentRetryArrived!: () => void;
      const commentRetryArrived = new Promise<void>((resolve) => {
        markCommentRetryArrived = resolve;
      });
      let markAccountRecovering!: () => void;
      const accountRecovering = new Promise<void>((resolve) => {
        markAccountRecovering = resolve;
      });

      server.use(
        // 요청 A: 만료 토큰이면 바로 401, 재시도는 B가 회복을 시도한 뒤에야 서버에서 처리된다
        http.post(COMMENT_HANDLER_URL, async ({ request }) => {
          const token = request.headers.get('X-Access-Token');

          if (token === EXPIRED_TOKEN) {
            return make401('TOKEN_EXPIRED');
          }

          markCommentRetryArrived();
          await accountRecovering;
          return token === validToken ? makeCommentSuccess() : make401('TOKEN_EXPIRED');
        }),
        // 요청 B: 만료 토큰으로 보낸 요청의 401이 refresh가 끝나고 A가 재시도를 보낸 뒤에 도착한다
        http.get(ACCOUNT_HANDLER_URL, async ({ request }) => {
          const token = request.headers.get('X-Access-Token');

          if (token === EXPIRED_TOKEN) {
            await commentRetryArrived;
            return make401('TOKEN_EXPIRED');
          }

          markAccountRecovering();
          return token === validToken
            ? HttpResponse.json(
                {
                  status: 200,
                  message: 'ok',
                  data: { nickname: 'tester' },
                  timestamp: new Date().toISOString(),
                },
                { status: 200 }
              )
            : make401('TOKEN_EXPIRED');
        }),
        http.post(REFRESH_HANDLER_URL, () => {
          refreshCallCount++;
          validToken = `new-access-token-${refreshCallCount}`;

          // 두 번째 refresh도 B의 회복 시도다(수정 전 동작)
          if (refreshCallCount > 1) {
            markAccountRecovering();
          }

          return HttpResponse.json(
            {
              status: 200,
              message: 'ok',
              data: { accessToken: validToken },
              timestamp: new Date().toISOString(),
            },
            { status: 200 }
          );
        })
      );

      useAuthStore.getState().setAuth(EXPIRED_TOKEN);

      const commentRequest = apiClient.post(COMMENT_PATH, makeCommentFormData());
      const accountRequest = apiClient.get(API_ENDPOINTS.auth.account);

      await expect(accountRequest).resolves.toMatchObject({ nickname: 'tester' });
      // 늦게 온 401이 refresh를 또 부르면 2가 되고, 그 회전 때문에 A의 재시도가 만료된다
      expect(refreshCallCount).toBe(1);
      await expect(commentRequest).resolves.toMatchObject({ id: 'comment-uuid-1' });
      expect(useAuthStore.getState().accessToken).toBe('new-access-token-1');
      expect(NavigationService.navigate).not.toHaveBeenCalled();
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
  // Case 2-1: 동시에 두 요청이 401 TOKEN_EXPIRED + refresh 실패
  // 큐에서 기다리던 요청(팔로워)이 어떻게 끝나는지 — client.ts catch 블록 주석 참고
  // ─────────────────────────────────────────────────────────────
  describe('Case 2-1: 동시에 두 요청이 401 TOKEN_EXPIRED + refresh 실패', () => {
    it('refresh는 한 번만 호출되고, 두 요청 모두 reject 없이 pending으로 남은 채 로그인 페이지로 한 번 이동한다', async () => {
      let refreshCallCount = 0;

      server.use(
        http.post(COMMENT_HANDLER_URL, () => make401('TOKEN_EXPIRED')),
        http.post(REFRESH_HANDLER_URL, () => {
          refreshCallCount++;
          return make401('INVALID_REFRESH_TOKEN');
        })
      );

      useAuthStore.getState().setAuth('expired-access-token');

      const settled = vi.fn();
      apiClient.post(COMMENT_PATH, makeCommentFormData()).then(settled, settled);
      apiClient.post(COMMENT_PATH, makeCommentFormData()).then(settled, settled);

      await vi.waitFor(() => {
        expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.AUTH.LOGIN, {
          replace: true,
        });
      });

      // 이동 뒤에 늦게라도 resolve·reject되는지 몇 틱 더 흘려본다
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(refreshCallCount).toBe(1);
      expect(settled).not.toHaveBeenCalled();
      expect(NavigationService.navigate).toHaveBeenCalledTimes(1);
      expect(useAuthStore.getState().accessToken).toBeNull();
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

  describe('Case 6: 응답을 못 받음 (오프라인·연결 끊김)', () => {
    it('fetch가 reject하면 브라우저 문구 대신 NetworkError로 던진다', async () => {
      server.use(http.post(COMMENT_HANDLER_URL, () => HttpResponse.error()));

      useAuthStore.getState().setAuth('valid-access-token');

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        NetworkError
      );
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Case 7: 요청을 보낸 뒤 인증 세대가 바뀜(다른 탭·같은 탭의 명시적 로그인·로그아웃)
  // 그 사이 공유 refresh 쿠키가 새 계정의 것이 되어, 갱신·재시도하면 이 요청이 새 계정으로 실행된다.
  // 세대 변경은 요청이 서버에 가 있는 동안(MSW 핸들러 안에서) 저장값을 바꿔 흉내 낸다.
  // ─────────────────────────────────────────────────────────────
  describe('Case 7: 요청을 보낸 뒤 인증 세대가 바뀜', () => {
    const otherTabSignsIn = () => LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab');

    const refreshOk = (accessToken: string) =>
      HttpResponse.json(
        { status: 200, message: 'ok', data: { accessToken }, timestamp: new Date().toISOString() },
        { status: 200 }
      );

    it('7-1: TOKEN_EXPIRED여도 refresh·재시도 없이 SessionChangedError로 끝난다 - 새 계정으로 재실행하지 않는다', async () => {
      let commentCallCount = 0;
      let refreshCallCount = 0;
      server.use(
        http.post(COMMENT_HANDLER_URL, () => {
          commentCallCount++;
          otherTabSignsIn();
          return make401('TOKEN_EXPIRED');
        }),
        http.post(REFRESH_HANDLER_URL, () => {
          refreshCallCount++;
          return refreshOk('token-b');
        })
      );
      useAuthStore.getState().setAuth('token-a');

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        SessionChangedError
      );

      expect(refreshCallCount).toBe(0);
      expect(commentCallCount).toBe(1);
      expect(useAuthStore.getState().accessToken).toBe('token-a');
      expect(NavigationService.navigate).not.toHaveBeenCalled();
    });

    it('7-2: 이 탭이 이미 새 세션을 받아들여 토큰이 바뀌었어도, 보낸 뒤 세대가 바뀌었으면 재시도하지 않는다', async () => {
      let commentCallCount = 0;
      server.use(
        http.post(COMMENT_HANDLER_URL, () => {
          commentCallCount++;
          // 다른 탭의 로그인 → 이 탭이 쿠키로 새 세션을 받아들임(useAuthEpochSync)
          otherTabSignsIn();
          useAuthStore.getState().setAuth('token-b');
          return make401('TOKEN_EXPIRED');
        })
      );
      useAuthStore.getState().setAuth('token-a');

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        SessionChangedError
      );

      expect(commentCallCount).toBe(1);
    });

    it('7-3: refresh 응답을 기다리는 사이 세대가 바뀌면 받은 토큰을 버리고 리더·대기 요청 모두 SessionChangedError', async () => {
      let commentCallCount = 0;
      let refreshCallCount = 0;
      server.use(
        http.post(COMMENT_HANDLER_URL, () => {
          commentCallCount++;
          return make401('TOKEN_EXPIRED');
        }),
        http.post(REFRESH_HANDLER_URL, () => {
          refreshCallCount++;
          otherTabSignsIn();
          return refreshOk('token-b');
        })
      );
      useAuthStore.getState().setAuth('token-a');

      const results = await Promise.allSettled([
        apiClient.post(COMMENT_PATH, makeCommentFormData()),
        apiClient.post(COMMENT_PATH, makeCommentFormData()),
      ]);

      expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
      results.forEach((r) => {
        expect(r.status === 'rejected' && r.reason).toBeInstanceOf(SessionChangedError);
      });
      expect(refreshCallCount).toBe(1);
      expect(commentCallCount).toBe(2);
      expect(useAuthStore.getState().accessToken).toBe('token-a');
      expect(NavigationService.navigate).not.toHaveBeenCalled();
    });

    it('7-4: refresh가 실패해도 그사이 세대가 바뀌었으면 로그인 화면으로 보내지 않고 리더·대기 요청 모두 끝낸다', async () => {
      server.use(
        http.post(COMMENT_HANDLER_URL, () => make401('TOKEN_EXPIRED')),
        http.post(REFRESH_HANDLER_URL, () => {
          LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'out:other-tab');
          return make401('INVALID_REFRESH_TOKEN');
        })
      );
      useAuthStore.getState().setAuth('token-a');

      const results = await Promise.allSettled([
        apiClient.post(COMMENT_PATH, makeCommentFormData()),
        apiClient.post(COMMENT_PATH, makeCommentFormData()),
      ]);

      results.forEach((r) => {
        expect(r.status === 'rejected' && r.reason).toBeInstanceOf(SessionChangedError);
      });
      expect(NavigationService.navigate).not.toHaveBeenCalled();
    });

    it('7-5: 같은 탭에서 로그아웃한 순간 진행 중이던 요청이 TOKEN_EXPIRED여도 로그인 화면으로 다시 보내지 않는다', async () => {
      let refreshCallCount = 0;
      server.use(
        http.post(COMMENT_HANDLER_URL, () => {
          // 로그아웃: 토큰·세션 플래그 정리 뒤 세대 기록(auth.queries.ts useLogoutMutation)
          useAuthStore.getState().clearAuth();
          AuthEpochUtil.markLogout();
          return make401('TOKEN_EXPIRED');
        }),
        http.post(REFRESH_HANDLER_URL, () => {
          refreshCallCount++;
          return make401('INVALID_REFRESH_TOKEN');
        })
      );
      useAuthStore.getState().setAuth('token-a');
      AuthEpochUtil.markLogin();

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        SessionChangedError
      );

      expect(refreshCallCount).toBe(0);
      expect(NavigationService.navigate).not.toHaveBeenCalled();
    });

    it('7-6: 인라인 로그인 직전에 비로그인으로 보낸 요청이 NOT_LOGGED_IN으로 돌아와도 방금 한 로그인을 지우지 않는다', async () => {
      server.use(
        http.post(COMMENT_HANDLER_URL, () => {
          // 요청이 서버에 가 있는 동안 이 탭에서 로그인(auth.queries.ts useLoginMutation 순서)
          useAuthStore.getState().setAuth('token-new');
          AuthEpochUtil.markLogin();
          return make401('NOT_LOGGED_IN');
        })
      );

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        SessionChangedError
      );

      expect(useAuthStore.getState().accessToken).toBe('token-new');
      expect(NavigationService.navigate).not.toHaveBeenCalled();
    });

    it('7-7: 다른 탭의 로그인을 알아챈 뒤 새 세션을 받아들이기 전에 시작한 요청도 옛 세대로 잡혀 재실행하지 않는다', async () => {
      // 시작할 때 저장 세대를 읽었다면 이 요청은 새 세대로 잡혀 refresh(새 계정 쿠키) → 재시도로 새 계정이 실행된다
      let commentCallCount = 0;
      let refreshCallCount = 0;
      server.use(
        http.post(COMMENT_HANDLER_URL, () => {
          commentCallCount++;
          return make401('TOKEN_EXPIRED');
        }),
        http.post(REFRESH_HANDLER_URL, () => {
          refreshCallCount++;
          return refreshOk('token-b');
        })
      );
      useAuthStore.getState().setAuth('token-a');
      AuthEpochUtil.markLogin();
      // useAuthEpochSync가 알아챘지만(acknowledge) 받아들이기 refresh는 아직 - 토큰은 그대로 token-a
      otherTabSignsIn();
      AuthEpochUtil.acknowledge();

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        SessionChangedError
      );

      expect(refreshCallCount).toBe(0);
      expect(commentCallCount).toBe(1);
      expect(useAuthStore.getState().accessToken).toBe('token-a');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Case 8: refresh 쿠키 주인이 다른 회원(BE 409 SESSION_MISMATCH) - 인증 세대는 그대로
  // 업데이트 전 번들 탭의 로그인처럼 세대를 안 바꾸고 계정이 바뀐 경우다. MSW refresh는 BE처럼 X-Access-Token이
  // 있으면(이 탭의 옛 계정 토큰) 409, 없으면 새 계정 토큰을 준다.
  // ─────────────────────────────────────────────────────────────
  describe('Case 8: refresh 쿠키 주인이 다른 회원 (SESSION_MISMATCH)', () => {
    const make409Mismatch = () =>
      HttpResponse.json(
        {
          status: 409,
          code: SERVER_ERROR_CODE.SESSION_MISMATCH,
          message: 'session mismatch',
          timestamp: new Date().toISOString(),
        },
        { status: 409 }
      );

    const refreshLikeBe = (onRequest?: (hint: string | null) => void) =>
      http.post(REFRESH_HANDLER_URL, ({ request }) => {
        const hint = request.headers.get('X-Access-Token');
        onRequest?.(hint);

        if (hint) {
          return make409Mismatch();
        }

        return HttpResponse.json(
          { status: 200, message: 'ok', data: { accessToken: 'token-b' }, timestamp: '' },
          { status: 200 }
        );
      });

    // 안내 토스트는 AuthUtil이 래퍼(@/shared/lib/toast/toast)로 띄운다 - 그 info를 지켜본다
    let toastInfo: MockInstance<typeof toast.info>;

    beforeEach(() => {
      toastInfo = vi.spyOn(toast, 'info');
    });

    afterEach(() => {
      toastInfo.mockRestore();
      window.history.replaceState(null, '', '/');
    });

    it('8-1: 원 요청의 토큰을 실어 갱신하고, 거절되면 이 탭만 로그아웃·안내 1번 - 로그인 화면 이동·세션 플래그 삭제 없음', async () => {
      const hints: Array<string | null> = [];
      server.use(
        http.post(COMMENT_HANDLER_URL, () => make401('TOKEN_EXPIRED')),
        refreshLikeBe((hint) => hints.push(hint))
      );
      useAuthStore.getState().setAuth('token-a');

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        SessionChangedError
      );

      expect(hints).toEqual(['token-a']);
      expect(useAuthStore.getState().accessToken).toBeNull();
      // 쿠키 주인 계정이 새로고침 때 복원되도록 공유 세션 플래그는 남는다(clearAll과 다름)
      expect(LocalStorageUtil.getItem(STORAGE_KEYS.AUTH.HAS_SESSION)).toBe(true);
      expect(NavigationService.navigate).not.toHaveBeenCalled();
      expect(toastInfo).toHaveBeenCalledTimes(1);
      expect(toastInfo).toHaveBeenCalledWith(
        TEXTS.messages.info.signedOutForOtherAccount,
        expect.objectContaining({ id: 'session-mismatch' })
      );
    });

    it('8-2: 함께 기다리던 요청도 영원히 남지 않고 SessionChangedError로 끝난다', async () => {
      let refreshCallCount = 0;
      server.use(
        http.post(COMMENT_HANDLER_URL, () => make401('TOKEN_EXPIRED')),
        refreshLikeBe(() => {
          refreshCallCount++;
        })
      );
      useAuthStore.getState().setAuth('token-a');

      const results = await Promise.allSettled([
        apiClient.post(COMMENT_PATH, makeCommentFormData()),
        apiClient.post(COMMENT_PATH, makeCommentFormData()),
      ]);

      results.forEach((r) => {
        expect(r.status === 'rejected' && r.reason).toBeInstanceOf(SessionChangedError);
      });
      expect(refreshCallCount).toBe(1);
    });

    it('8-3: 보호 경로에 있었으면 /post로 옮긴다', async () => {
      window.history.replaceState(null, '', ROUTES_PATHS.BOOKMARK);
      server.use(
        http.post(COMMENT_HANDLER_URL, () => make401('TOKEN_EXPIRED')),
        refreshLikeBe()
      );
      useAuthStore.getState().setAuth('token-a');

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        SessionChangedError
      );

      expect(NavigationService.navigate).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, {
        replace: true,
      });
    });

    it('8-4: 로그아웃 뒤 늦게 도착한 같은 토큰 요청의 401도 새 계정으로 재실행하지 않고, 로그아웃·안내를 반복하지 않는다', async () => {
      // 첫 요청의 401로 이 탭이 로그아웃된 뒤 두 번째 요청의 401이 온다. 스토어 토큰이 비어 있어 헤더를 스토어에서
      // 만들면 BE가 비교를 건너뛰고 새 계정 토큰을 준다 - 그러면 두 번째 요청이 새 계정으로 재실행된다.
      let releaseSecond!: () => void;
      const secondHeld = new Promise<void>((resolve) => {
        releaseSecond = resolve;
      });
      let commentCallCount = 0;
      server.use(
        http.post(COMMENT_HANDLER_URL, async () => {
          commentCallCount++;

          if (commentCallCount === 2) {
            await secondHeld;
          }

          return make401('TOKEN_EXPIRED');
        }),
        refreshLikeBe()
      );
      useAuthStore.getState().setAuth('token-a');

      const first = apiClient.post(COMMENT_PATH, makeCommentFormData());
      const second = apiClient.post(COMMENT_PATH, makeCommentFormData());
      await expect(first).rejects.toBeInstanceOf(SessionChangedError);
      expect(useAuthStore.getState().accessToken).toBeNull();

      releaseSecond();

      await expect(second).rejects.toBeInstanceOf(SessionChangedError);
      expect(commentCallCount).toBe(2);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(toastInfo).toHaveBeenCalledTimes(1);
    });

    it('8-5: 세대도 바뀌었으면 세대 분기가 먼저 처리한다 - 이 탭은 useAuthEpochSync가 맞추므로 여기서 로그아웃·안내하지 않는다', async () => {
      server.use(
        http.post(COMMENT_HANDLER_URL, () => make401('TOKEN_EXPIRED')),
        http.post(REFRESH_HANDLER_URL, () => {
          LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.EPOCH, 'in:other-tab');
          return make409Mismatch();
        })
      );
      useAuthStore.getState().setAuth('token-a');

      await expect(apiClient.post(COMMENT_PATH, makeCommentFormData())).rejects.toBeInstanceOf(
        SessionChangedError
      );

      expect(useAuthStore.getState().accessToken).toBe('token-a');
      expect(toastInfo).not.toHaveBeenCalled();
    });
  });
});

// ─────────────────────────────────────────────────────────────
// CloudFront OAC 대응 (docs/plans/2026-09-29-oac-lockdown.md FE Phase 6) -
// 인증 헤더가 Authorization 대신 X-Access-Token인지, 문자열 바디에
// x-amz-content-sha256이 실리는지를 검증한다. 401 처리와는 무관한 관심사라
// 위 describe와 별개 최상위 블록으로 둔다.
// ─────────────────────────────────────────────────────────────
describe('ApiClient — 요청 헤더 (CloudFront OAC 대응)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    useAuthStore.getState().clearAuth();
  });

  it('토큰이 있으면 Authorization 대신 X-Access-Token 헤더로 보낸다', async () => {
    useAuthStore.getState().setAuth('valid-access-token');

    let capturedHeaders: Headers | undefined;
    server.use(
      http.post(COMMENT_HANDLER_URL, ({ request }) => {
        capturedHeaders = request.headers;
        return makeCommentSuccess();
      })
    );

    await apiClient.post(COMMENT_PATH, { content: '헤더 테스트' });

    expect(capturedHeaders?.get('x-access-token')).toBe('valid-access-token');
    expect(capturedHeaders?.has('authorization')).toBe(false);
  });

  it('JSON 바디가 있으면 x-amz-content-sha256 헤더에 바디의 SHA256 해시를 싣는다', async () => {
    useAuthStore.getState().setAuth('valid-access-token');

    let capturedHeaders: Headers | undefined;
    let capturedBody = '';
    server.use(
      http.post(COMMENT_HANDLER_URL, async ({ request }) => {
        capturedHeaders = request.headers;
        capturedBody = await request.text();
        return makeCommentSuccess();
      })
    );

    await apiClient.post(COMMENT_PATH, { content: '해시 테스트' });

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(capturedBody));
    const expectedHash = Array.from(new Uint8Array(digest))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');

    expect(capturedHeaders?.get('x-amz-content-sha256')).toBe(expectedHash);
  });

  it('FormData 바디에는 x-amz-content-sha256 헤더를 붙이지 않는다', async () => {
    // 브라우저가 전송 시점에 실제 멀티파트 바이트를 만들어 미리 해시할 방법이 없다
    // (client.ts의 hashRequestBody 주석 참고) - 헤더 자체를 생략하는지만 확인한다.
    useAuthStore.getState().setAuth('valid-access-token');

    let capturedHeaders: Headers | undefined;
    server.use(
      http.post(COMMENT_HANDLER_URL, ({ request }) => {
        capturedHeaders = request.headers;
        return makeCommentSuccess();
      })
    );

    await apiClient.post(COMMENT_PATH, makeCommentFormData());

    expect(capturedHeaders?.has('x-amz-content-sha256')).toBe(false);
  });

  it('바디 없는 POST(예: refresh)에도 빈 문자열의 해시를 싣는다', async () => {
    // AWS 문서는 "PUT/POST면"이라고만 하지 바디 유무를 구분하지 않는다 - 헤더 자체가
    // 없으면 CloudFront가 OAC 서명에 쓸 해시를 몰라 요청이 거절될 수 있다. 빈 문자열의
    // SHA256은 고정값(e3b0c442...)이라 그대로 기대값으로 쓴다.
    let capturedHeaders: Headers | undefined;
    server.use(
      http.post(REFRESH_HANDLER_URL, ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { accessToken: 'new-token' },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        );
      })
    );

    await apiClient.post(API_ENDPOINTS.auth.refresh);

    expect(capturedHeaders?.get('x-amz-content-sha256')).toBe(
      'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
    );
  });

  it('로그인 엔드포인트는 X-Access-Token 헤더를 붙이지 않는다', async () => {
    // isAuthEndpoint 목록(로그인·회원가입)은 토큰이 있어도 제거한다 - 헤더 이름이
    // Authorization에서 바뀌었으니 회귀 방지로 고정해둔다.
    useAuthStore.getState().setAuth('valid-access-token');

    let capturedHeaders: Headers | undefined;
    server.use(
      http.post(mswUrl(API_ENDPOINTS.auth.login), ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { accessToken: 'token' },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        );
      })
    );

    await apiClient.post(API_ENDPOINTS.auth.login, { email: 'a@b.com', password: 'pw' });

    expect(capturedHeaders?.has('x-access-token')).toBe(false);
  });

  it('refresh 요청에는 X-Access-Token을 그대로 싣는다 - BE가 쿠키 주인과 같은 회원인지 확인하는 데 쓴다', async () => {
    // refresh를 isAuthEndpoint 목록에 넣으면 이 헤더가 빠져 SESSION_MISMATCH 확인이 조용히 꺼진다
    useAuthStore.getState().setAuth('valid-access-token');

    let capturedHeaders: Headers | undefined;
    server.use(
      http.post(mswUrl(API_ENDPOINTS.auth.refresh), ({ request }) => {
        capturedHeaders = request.headers;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { accessToken: 'next' }, timestamp: '' },
          { status: 200 }
        );
      })
    );

    await apiClient.post(API_ENDPOINTS.auth.refresh);

    expect(capturedHeaders?.get('x-access-token')).toBe('valid-access-token');
  });
});
