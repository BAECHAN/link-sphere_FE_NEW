import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { http, HttpResponse } from 'msw';
import { MutationObserver } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { apiClient } from '@/shared/api/client';
import { useAuthStore } from '@/shared/store/auth.store';
import { AuthUtil } from '@/shared/utils/auth.util';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { SessionChangedError } from '@/shared/types/common.type';
// 전역 에러 핸들러(mutationCache.onError)가 붙은 실제 싱글턴이어야 이 겹침이 드러난다
// eslint-disable-next-line custom-query-rules/no-query-client-singleton-import
import { queryClient } from '@/shared/lib/react-query/config/queryClient';

vi.mock('@/shared/lib/router/navigation', () => ({
  NavigationService: { navigate: vi.fn(), setNavigate: vi.fn() },
}));

const mswUrl = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const COMMENT_PATH = API_ENDPOINTS.post.postComment('test-post-uuid');

const makeCommentFormData = () => {
  const fd = new FormData();
  fd.append('content', '테스트 댓글');
  return fd;
};

/**
 * SESSION_MISMATCH로 이 탭을 로그아웃한 순간, 그 refresh를 기다리던 mutation이 받은 SessionChangedError의 전역
 * 에러 토스트가 안내 토스트와 겹쳐 뜨지 않는지(docs/AUTH.md §8-B "토스트 위치"). client.test.ts Case 8은 apiClient를
 * 직접 불러 전역 핸들러를 거치지 않으므로, 여기서는 실제 queryClient로 mutation을 실행한다.
 */
describe('SESSION_MISMATCH 로그아웃과 전역 에러 토스트', () => {
  let toastInfo: MockInstance<typeof toast.info>;
  let toastError: MockInstance<typeof toast.error>;

  beforeEach(() => {
    queryClient.clear();
    toastInfo = vi.spyOn(toast, 'info');
    toastError = vi.spyOn(toast, 'error');
    server.use(
      http.post(mswUrl(COMMENT_PATH), () =>
        HttpResponse.json(
          { status: 401, code: SERVER_ERROR_CODE.TOKEN_EXPIRED, message: '', timestamp: '' },
          { status: 401 }
        )
      ),
      http.post(mswUrl(API_ENDPOINTS.auth.refresh), () =>
        HttpResponse.json(
          { status: 409, code: SERVER_ERROR_CODE.SESSION_MISMATCH, message: '', timestamp: '' },
          { status: 409 }
        )
      )
    );
    useAuthStore.getState().setAuth('token-a');
  });

  afterEach(() => {
    toastInfo.mockRestore();
    toastError.mockRestore();
    queryClient.clear();
    AuthUtil.resetLogoutGuard();
    window.history.replaceState(null, '', '/');
  });

  it('보호 경로가 아니고 화면에 활성 쿼리가 없어도 안내만 뜨고 에러 토스트는 뜨지 않는다', async () => {
    // 이 경로는 clearQueries를 타는데, 활성 쿼리가 없으면 그 재조회 유예가 mutation의 에러보다 먼저 풀린다
    window.history.replaceState(null, '', ROUTES_PATHS.POST.ROOT);
    const mutation = new MutationObserver(queryClient, {
      mutationFn: () => apiClient.post(COMMENT_PATH, makeCommentFormData()),
    });

    await expect(mutation.mutate()).rejects.toBeInstanceOf(SessionChangedError);

    expect(toastInfo).toHaveBeenCalledTimes(1);
    expect(toastInfo).toHaveBeenCalledWith(
      TEXTS.messages.info.signedOutForOtherAccount,
      expect.objectContaining({ id: 'session-mismatch' })
    );
    expect(toastError).not.toHaveBeenCalled();
  });
});
