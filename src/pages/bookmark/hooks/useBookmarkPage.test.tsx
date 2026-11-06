import { type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { bookmarkFolderKeys } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { MemoryRouter, useLocation, useNavigationType } from 'react-router-dom';
import { createTestQueryClient } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { useBookmarkPage } from '@/pages/bookmark/hooks/useBookmarkPage';

const { mobileState } = vi.hoisted(() => ({ mobileState: { value: false } }));

vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => mobileState.value }));

function renderPage(initialUrl: string) {
  const queryClient = createTestQueryClient();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  const hook = renderHook(
    () => {
      const page = useBookmarkPage();
      const location = useLocation();
      const navigationType = useNavigationType();

      return { page, search: location.search, navigationType };
    },
    { wrapper: Wrapper }
  );

  return { ...hook, queryClient };
}

async function waitForFolderList(queryClient: QueryClient) {
  await waitFor(() => expect(queryClient.getQueryData(bookmarkFolderKeys.list)).toBeDefined());
}

describe('useBookmarkPage', () => {
  beforeEach(() => {
    mobileState.value = false;
  });

  describe('URL 파싱', () => {
    it('쿼리가 없으면 전체 폴더·최신순·빈 검색어가 기본값이다', () => {
      const { result } = renderPage('/bookmark');

      expect(result.current.page.activeFolderKey).toBe('all');
      expect(result.current.page.sort).toBe('latest');
      expect(result.current.page.search).toBe('');
      expect(result.current.page.currentFolderName).toBe(TEXTS.bookmark.folder.all);
    });

    it('folder·sort·q 쿼리를 읽어 돌려준다', () => {
      const { result } = renderPage('/bookmark?folder=uncategorized&sort=viewed&q=react');

      expect(result.current.page.activeFolderKey).toBe('uncategorized');
      expect(result.current.page.sort).toBe('viewed');
      expect(result.current.page.search).toBe('react');
    });

    it.each(['latest', 'oldest', 'title', 'viewed'])('정렬 %s를 그대로 받아들인다', (sort) => {
      const { result } = renderPage(`/bookmark?sort=${sort}`);

      expect(result.current.page.sort).toBe(sort);
    });

    it('알 수 없는 정렬 값은 최신순으로 되돌린다', () => {
      const { result } = renderPage('/bookmark?sort=bogus');

      expect(result.current.page.sort).toBe('latest');
    });

    it('folder=all이면 전체, folder=uncategorized면 미분류 이름을 보여준다', () => {
      const all = renderPage('/bookmark?folder=all');
      const uncategorized = renderPage('/bookmark?folder=uncategorized');

      expect(all.result.current.page.currentFolderName).toBe(TEXTS.bookmark.folder.all);
      expect(all.result.current.page.currentFolder).toBeUndefined();
      expect(uncategorized.result.current.page.currentFolderName).toBe(
        TEXTS.bookmark.folder.uncategorized
      );
      expect(uncategorized.result.current.page.currentFolder).toBeUndefined();
    });
  });

  describe('빈 folder 쿼리', () => {
    it('folder 값이 비어 있으면 쿼리가 없는 것과 같게 전체로 본다', () => {
      mobileState.value = true;
      const { result } = renderPage('/bookmark?folder=');

      expect(result.current.page.activeFolderKey).toBe('all');
      expect(result.current.page.isMobileListMode).toBe(true);
    });
  });

  describe('폴더 목록을 불러온 뒤', () => {
    it('전체·미분류에서는 현재 폴더가 없다', async () => {
      const all = renderPage('/bookmark?folder=all');
      const none = renderPage('/bookmark');
      const uncategorized = renderPage('/bookmark?folder=uncategorized');

      await waitForFolderList(all.queryClient);
      await waitForFolderList(none.queryClient);
      await waitForFolderList(uncategorized.queryClient);

      expect(all.result.current.page.currentFolder).toBeUndefined();
      expect(none.result.current.page.currentFolder).toBeUndefined();
      expect(uncategorized.result.current.page.currentFolder).toBeUndefined();
    });

    it('폴더가 여러 개일 때 URL의 폴더가 첫 항목이 아니어도 그대로 두고 그 폴더를 고른다', async () => {
      const folders = [
        { ...mockBookmarkFolder, id: 'folder-a', name: 'A' },
        { ...mockBookmarkFolder, id: 'folder-b', name: 'B' },
      ];

      server.use(
        http.get(`${API_BASE_URL}${API_ENDPOINTS.bookmark.folders}`, () =>
          HttpResponse.json(
            {
              status: 200,
              message: 'ok',
              data: { folders, uncategorizedCount: 0 },
              timestamp: '',
            },
            { status: 200 }
          )
        )
      );

      const { result, queryClient } = renderPage('/bookmark?folder=folder-b');

      await waitForFolderList(queryClient);
      await waitFor(() => expect(result.current.page.currentFolderName).toBe('B'));

      expect(result.current.page.currentFolder?.id).toBe('folder-b');
      expect(result.current.search).toBe('?folder=folder-b');
    });
  });

  describe('모바일 목록 모드', () => {
    it('모바일에서 folder 쿼리가 없으면 폴더 목록 모드다', () => {
      mobileState.value = true;
      const { result } = renderPage('/bookmark');

      expect(result.current.page.isMobile).toBe(true);
      expect(result.current.page.isMobileListMode).toBe(true);
    });

    it('모바일에서도 folder 쿼리가 있으면 목록 모드가 아니다', () => {
      mobileState.value = true;
      const { result } = renderPage('/bookmark?folder=all');

      expect(result.current.page.isMobileListMode).toBe(false);
      expect(result.current.page.activeFolderKey).toBe('all');
    });

    it('데스크탑에서는 folder 쿼리가 없어도 목록 모드가 아니다', () => {
      const { result } = renderPage('/bookmark');

      expect(result.current.page.isMobile).toBe(false);
      expect(result.current.page.isMobileListMode).toBe(false);
    });
  });

  describe('현재 폴더', () => {
    it('폴더 목록을 불러오면 UUID에 맞는 폴더와 이름을 돌려준다', async () => {
      const { result } = renderPage(`/bookmark?folder=${mockBookmarkFolder.id}`);

      await waitFor(() => expect(result.current.page.currentFolder).toEqual(mockBookmarkFolder));

      expect(result.current.page.currentFolderName).toBe(mockBookmarkFolder.name);
    });

    it('목록을 아직 못 불러왔으면 대체 이름을 보여준다', () => {
      const { result } = renderPage(`/bookmark?folder=${mockBookmarkFolder.id}`);

      expect(result.current.page.currentFolder).toBeUndefined();
      expect(result.current.page.currentFolderName).toBe(TEXTS.bookmark.folder.fallbackName);
    });
  });

  describe('setFolderKey', () => {
    it('데스크탑에서 전체를 고르면 folder 쿼리를 지우고 기록을 쌓는다', () => {
      const { result } = renderPage('/bookmark?folder=uncategorized&sort=title');

      act(() => {
        result.current.page.setFolderKey('all');
      });

      expect(result.current.search).toBe('?sort=title');
      expect(result.current.navigationType).toBe('PUSH');
    });

    it('모바일에서 전체를 고르면 folder=all을 남긴다', () => {
      mobileState.value = true;
      const { result } = renderPage('/bookmark?folder=uncategorized');

      act(() => {
        result.current.page.setFolderKey('all');
      });

      expect(result.current.search).toBe('?folder=all');
      expect(result.current.navigationType).toBe('PUSH');
    });

    it('다른 폴더를 고르면 folder 쿼리에 담는다', () => {
      const { result } = renderPage('/bookmark?q=react');

      act(() => {
        result.current.page.setFolderKey('uncategorized');
      });

      expect(result.current.search).toBe('?q=react&folder=uncategorized');
      expect(result.current.page.activeFolderKey).toBe('uncategorized');
    });
  });

  describe('setSort', () => {
    it('최신순을 고르면 sort 쿼리를 지우고 기록을 덮어쓴다', () => {
      const { result } = renderPage('/bookmark?sort=title&folder=uncategorized');

      act(() => {
        result.current.page.setSort('latest');
      });

      expect(result.current.search).toBe('?folder=uncategorized');
      expect(result.current.navigationType).toBe('REPLACE');
    });

    it('다른 정렬을 고르면 sort 쿼리에 담고 기록을 덮어쓴다', () => {
      const { result } = renderPage('/bookmark?folder=uncategorized');

      act(() => {
        result.current.page.setSort('oldest');
      });

      expect(result.current.search).toBe('?folder=uncategorized&sort=oldest');
      expect(result.current.page.sort).toBe('oldest');
      expect(result.current.navigationType).toBe('REPLACE');
    });
  });

  describe('goToFolderList', () => {
    it('folder 쿼리만 지우고 기록을 쌓는다', () => {
      mobileState.value = true;
      const { result } = renderPage('/bookmark?folder=uncategorized&sort=title');

      act(() => {
        result.current.page.goToFolderList();
      });

      expect(result.current.search).toBe('?sort=title');
      expect(result.current.navigationType).toBe('PUSH');
      expect(result.current.page.isMobileListMode).toBe(true);
    });
  });

  describe('없는 폴더 리다이렉트', () => {
    it('목록에 없는 폴더 UUID가 URL에 있으면 folder 쿼리를 지우고 기록을 덮어쓴다', async () => {
      const { result } = renderPage('/bookmark?folder=deleted-folder&sort=title');

      await waitFor(() => expect(result.current.search).toBe('?sort=title'));

      expect(result.current.navigationType).toBe('REPLACE');
      expect(result.current.page.activeFolderKey).toBe('all');
    });

    it('목록에 있는 폴더는 URL을 그대로 둔다', async () => {
      const { result } = renderPage(`/bookmark?folder=${mockBookmarkFolder.id}`);

      await waitFor(() => expect(result.current.page.currentFolder).toBeDefined());

      expect(result.current.search).toBe(`?folder=${mockBookmarkFolder.id}`);
      expect(result.current.navigationType).toBe('POP');
    });

    it('all·uncategorized는 목록을 불러온 뒤에도 URL을 그대로 둔다', async () => {
      const all = renderPage('/bookmark?folder=all');
      const uncategorized = renderPage('/bookmark?folder=uncategorized');

      await waitForFolderList(all.queryClient);
      await waitForFolderList(uncategorized.queryClient);

      expect(all.result.current.search).toBe('?folder=all');
      expect(uncategorized.result.current.search).toBe('?folder=uncategorized');
    });

    it('folder 쿼리가 없으면 목록을 불러와도 URL을 건드리지 않는다', async () => {
      const { result, queryClient } = renderPage('/bookmark?sort=title');

      await waitForFolderList(queryClient);

      expect(result.current.search).toBe('?sort=title');
      expect(result.current.navigationType).toBe('POP');
    });
  });
});
