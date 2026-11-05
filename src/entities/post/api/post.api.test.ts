import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import NProgress from 'nprogress';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { mockPostListResponse } from '@/mocks/fixtures/post.fixtures';
import { postApi } from '@/entities/post/api/post.api';

vi.mock('nprogress', () => ({
  default: { configure: vi.fn(), start: vi.fn(), done: vi.fn() },
}));

describe('postApi.fetchPostList', () => {
  let requestedSearch: URLSearchParams | undefined;

  beforeEach(() => {
    vi.mocked(NProgress.start).mockClear();
    vi.mocked(NProgress.done).mockClear();
    requestedSearch = undefined;

    server.use(
      http.get(`${API_BASE_URL}${API_ENDPOINTS.post.base}`, ({ request }) => {
        requestedSearch = new URL(request.url).searchParams;

        return HttpResponse.json({
          status: 200,
          message: 'ok',
          data: mockPostListResponse,
          timestamp: '',
        });
      })
    );
  });

  it('첫 쪽은 cursor 없이 보내고 진행 표시를 켰다 끈다', async () => {
    await postApi.fetchPostList({ size: 10 });

    expect(requestedSearch?.has('cursor')).toBe(false);
    expect(requestedSearch?.has('page')).toBe(false);
    expect(NProgress.start).toHaveBeenCalledTimes(1);
    expect(NProgress.done).toHaveBeenCalledTimes(1);
  });

  it('다음 쪽은 받은 cursor를 그대로 보내고 진행 표시를 켜지 않는다', async () => {
    await postApi.fetchPostList({ cursor: 'cursor-1', size: 10 });

    expect(requestedSearch?.get('cursor')).toBe('cursor-1');
    expect(requestedSearch?.has('page')).toBe(false);
    expect(NProgress.start).not.toHaveBeenCalled();
    expect(NProgress.done).not.toHaveBeenCalled();
  });
});
