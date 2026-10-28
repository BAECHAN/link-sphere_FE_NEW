import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MutationObserver } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/store/auth.store';
import { AuthUtil } from '@/shared/utils/auth.util';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { toast } from '@/shared/lib/toast/toast';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { SessionExpiredError } from '@/shared/types/common.type';
// 전역 에러 핸들러(mutationCache.onError)가 붙은 실제 싱글턴이어야 토스트가 드러난다
// eslint-disable-next-line custom-query-rules/no-query-client-singleton-import
import { queryClient } from '@/shared/lib/react-query/config/queryClient';

vi.mock('@/shared/lib/router/navigation', () => ({
  NavigationService: { navigate: vi.fn(), setNavigate: vi.fn() },
}));

const mswUrl = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const COMMENT_PATH = API_ENDPOINTS.post.postComment('test-post-uuid');
/** 만료 정리 뒤 이 시간이 지나면 로그아웃 유예 창(LogoutGraceUtil, 2000ms)이 닫힌다 */
const AFTER_LOGOUT_GRACE_MS = 3000;

const makeCommentFormData = () => {
  const fd = new FormData();
  fd.append('content', '테스트 댓글');
  return fd;
};

const make401 = (code: string) =>
  HttpResponse.json({ status: 401, code, message: '', timestamp: '' }, { status: 401 });

/**
 * 로그인 만료로 끝난 mutation이 실패 토스트를 띄우지 않는지(안내는 만료 정리가 맡는다, docs/AUTH.md §8-B).
 * SessionExpiredError는 ApiError가 아니라 로그아웃 유예 창(LogoutGraceUtil)의 무음 처리를 타지 않는다 - error-toast.ts의
 * 만료 분기가 없으면 meta.errorMessage 토스트가 뜬다. 정리 직후의 실패와, 유예 창이 닫힌 뒤 늦게 도착한 401(느린
 * 응답, client.test.ts Case 2-2 경로) 둘 다 본다. client.test.ts는 apiClient를 직접 불러 전역 핸들러를 거치지
 * 않으므로, 여기서는 실제 queryClient로 mutation을 실행한다(선례: session-mismatch-toast.test.ts).
 */
describe('로그인 만료와 전역 에러 토스트', () => {
  let toastError: MockInstance<typeof toast.error>;

  beforeEach(() => {
    // setTimeout은 진짜로 두고(MSW 응답) 시계만 움직인다
    vi.useFakeTimers({ toFake: ['Date'] });
    queryClient.clear();
    toastError = vi.spyOn(toast, 'error');
    useAuthStore.getState().setAuth('token-a');
  });

  afterEach(() => {
    vi.useRealTimers();
    toastError.mockRestore();
    queryClient.clear();
    AuthUtil.resetLogoutGuard();
  });

  it('정리 직후와 유예 창이 닫힌 뒤의 만료 실패 모두 errorMessage가 붙은 mutation의 토스트를 띄우지 않는다', async () => {
    let releaseLate!: () => void;
    const lateReleased = new Promise<void>((resolve) => {
      releaseLate = resolve;
    });

    server.use(
      http.post(mswUrl(COMMENT_PATH), () => make401(SERVER_ERROR_CODE.TOKEN_EXPIRED)),
      http.patch(mswUrl(API_ENDPOINTS.auth.account), async () => {
        await lateReleased;
        return make401(SERVER_ERROR_CODE.TOKEN_EXPIRED);
      }),
      http.post(mswUrl(API_ENDPOINTS.auth.refresh), () => make401('INVALID_REFRESH_TOKEN'))
    );

    const comment = new MutationObserver(queryClient, {
      mutationFn: () => apiClient.post(COMMENT_PATH, makeCommentFormData()),
      meta: { errorMessage: '댓글 등록에 실패했어요.' },
    });
    const lateUpdate = new MutationObserver(queryClient, {
      mutationFn: () => apiClient.patch(API_ENDPOINTS.auth.account, { nickname: 'tester' }),
      meta: { errorMessage: '정보를 수정하지 못했어요.' },
    });

    const commentResult = comment.mutate();
    const lateResult = lateUpdate.mutate();

    await expect(commentResult).rejects.toBeInstanceOf(SessionExpiredError);

    vi.setSystemTime(Date.now() + AFTER_LOGOUT_GRACE_MS);
    expect(AuthUtil.isLoggingOut()).toBe(false);
    releaseLate();

    await expect(lateResult).rejects.toBeInstanceOf(SessionExpiredError);
    expect(toastError).not.toHaveBeenCalled();
  });
});
