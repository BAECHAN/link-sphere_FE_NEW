import { Suspense, type ReactNode } from 'react';
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { usePostDetail } from '@/pages/post/hooks/usePostDetail';
import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';
import { server } from '@/mocks/server';
import { TEXTS } from '@/shared/config/texts';
import { createTestQueryClient } from '@/test/utils';

type Entry = string | { pathname: string; state?: unknown };

function renderPostDetail(entries: Entry[], initialIndex = entries.length - 1) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={entries} initialIndex={initialIndex}>
          <Suspense fallback={null}>
            <Routes>
              <Route path="/post/:id" element={children} />
            </Routes>
          </Suspense>
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  const rendered = renderHook(
    () => ({ detail: usePostDetail(), navigate: useNavigate(), location: useLocation() }),
    { wrapper: Wrapper }
  );

  return rendered;
}

function trackViewRequests() {
  const viewedIds: string[] = [];

  server.use(
    http.post('/post/{id}/view', ({ params }) => {
      viewedIds.push(String(params.id));
      return MockEnvelopeUtil.unit();
    })
  );

  return viewedIds;
}

// 조회 기록을 세지 않는 테스트는 POST를 보내지 않게 한다. 언마운트해도 보낸 요청은 취소되지 않아, 앞 테스트의 요청이
// 다음 테스트의 trackViewRequests에 잡혀 기록이 ['1', '1', '2']가 됐다(docs/TESTING.md "자주 발생하는 문제" 14번).
function skipViewRecord() {
  vi.stubEnv('MODE', 'development');
}

const FEED_ENTRY = { pathname: '/post/1', state: { backSource: 'feed' } };
const BOOKMARK_ENTRY = { pathname: '/post/1', state: { backSource: 'bookmark' } };

describe('usePostDetail', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe('돌아가기 라벨', () => {
    beforeEach(skipViewRecord);

    it('앱 안 이력 없이 들어온 경우(첫 진입 엔트리) "목록으로"를 보여 준다', async () => {
      const { result } = renderPostDetail(['/post/1']);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });
      expect(result.current.detail.backLabel).toBe(TEXTS.post.detail.backToList);
    });

    it('피드·검색에서 들어온 경우 "목록으로"를 보여 준다', async () => {
      const { result } = renderPostDetail(['/post', FEED_ENTRY]);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });
      expect(result.current.detail.backLabel).toBe(TEXTS.post.detail.backToList);
    });

    it('북마크에서 들어온 경우 목적지를 약속하지 않는 "뒤로가기"를 보여 준다', async () => {
      const { result } = renderPostDetail(['/bookmark', BOOKMARK_ENTRY]);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });
      expect(result.current.detail.backLabel).toBe(TEXTS.buttons.back);
    });

    it('출처를 모르는 앱 내 이동이면 "뒤로가기"를 보여 준다', async () => {
      const { result } = renderPostDetail(['/post', '/post/1']);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });
      expect(result.current.detail.backLabel).toBe(TEXTS.buttons.back);
    });

    it('같은 경로 위에 오버레이를 여는 PUSH에서는 유입 경로의 라벨을 유지한다', async () => {
      const { result } = renderPostDetail(['/post', FEED_ENTRY]);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });

      act(() => {
        result.current.navigate('/post/1', { state: { overlay: 'login' } });
      });

      await waitFor(() => {
        expect(result.current.location.state).toEqual({ overlay: 'login' });
      });
      expect(result.current.detail.backLabel).toBe(TEXTS.post.detail.backToList);
    });

    it('같은 경로에서 REPLACE로 위치가 바뀌면 라벨을 다시 계산한다', async () => {
      const { result } = renderPostDetail(['/post', FEED_ENTRY]);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });

      act(() => {
        result.current.navigate('/post/1', { replace: true });
      });

      await waitFor(() => {
        expect(result.current.detail.backLabel).toBe(TEXTS.buttons.back);
      });
    });

    it('다른 경로로 PUSH하면 라벨을 다시 계산한다', async () => {
      const { result } = renderPostDetail(['/post', FEED_ENTRY]);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });

      act(() => {
        result.current.navigate('/post/2');
      });

      await waitFor(() => {
        expect(result.current.detail.post.id).toBe('2');
      });
      expect(result.current.detail.backLabel).toBe(TEXTS.buttons.back);
    });
  });

  describe('탭 제목', () => {
    beforeEach(skipViewRecord);

    it('글 제목으로 탭 제목을 바꾸고 상세를 떠나면 원래 제목으로 되돌린다', async () => {
      document.title = '원래 제목';
      const { result, unmount } = renderPostDetail(['/post/1']);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });
      expect(document.title).toBe(
        TEXTS.post.detail.documentTitle(result.current.detail.post.title)
      );

      unmount();

      expect(document.title).toBe('원래 제목');
    });
  });

  describe('조회 기록', () => {
    it('상세가 뜨면 해당 글의 조회를 한 번 기록한다', async () => {
      const viewedIds = trackViewRequests();

      renderPostDetail(['/post/1']);

      await waitFor(() => {
        expect(viewedIds).toEqual(['1']);
      });
    });

    it('다른 글로 이동하면 그 글의 조회를 새로 기록한다', async () => {
      const viewedIds = trackViewRequests();
      const { result } = renderPostDetail(['/post/1']);

      await waitFor(() => {
        expect(viewedIds).toEqual(['1']);
      });

      act(() => {
        result.current.navigate('/post/2');
      });

      await waitFor(() => {
        expect(viewedIds).toEqual(['1', '2']);
      });
    });

    it('개발 모드에서는 운영 API를 보지 않도록 조회를 기록하지 않는다', async () => {
      vi.stubEnv('MODE', 'development');
      const viewedIds = trackViewRequests();

      const { result } = renderPostDetail(['/post/1']);

      await waitFor(() => {
        expect(result.current?.detail.post.id).toBe('1');
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(viewedIds).toEqual([]);
    });
  });
});
