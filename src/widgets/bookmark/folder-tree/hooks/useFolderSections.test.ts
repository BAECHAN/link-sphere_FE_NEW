import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { bookmarkFolderInvalidateQueries } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import { useFolderSections } from '@/widgets/bookmark/folder-tree/hooks/useFolderSections';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';

// FolderTree/MobileFolderList는 페이지 방문 내내 마운트돼 있어 "다시 열기" 같은 세션
// 경계가 없다 — 스냅샷을 쓰면 새로고침 전까지 옛 순서가 남았다(2026-09-21 버그,
// docs/BOOKMARK.md §10). 이 파일은 "언마운트 없이 목록이 갱신되면 구획도 따라 바뀐다"를
// 고정한다. 순수 선정 로직(임계값·완전 일치 배제·정렬) 자체는
// bookmark-folder.util.test.ts가 다룬다 — 여기선 다루지 않는다.

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function makeFolder(
  overrides: Partial<BookmarkFolder> & Pick<BookmarkFolder, 'id'>
): BookmarkFolder {
  return {
    name: overrides.id,
    sortOrder: 0,
    bookmarkCount: 0,
    lastUsedAt: undefined,
    ...overrides,
  };
}

function mockFolderListResponse(folders: BookmarkFolder[]) {
  server.use(
    http.get(url(API_ENDPOINTS.bookmark.folders), () => {
      return HttpResponse.json(
        {
          status: 200,
          message: 'ok',
          data: { folders, uncategorizedCount: 0 },
          timestamp: new Date().toISOString(),
        },
        { status: 200 }
      );
    })
  );
}

beforeEach(() => {
  queryClient = createTestQueryClient();
});

describe('useFolderSections', () => {
  it('언마운트 없이 목록이 갱신되면 최근 구획도 최신 순서로 바뀐다', async () => {
    const before = [1, 2, 3, 4].map((n) =>
      makeFolder({ id: `f${n}`, lastUsedAt: `2025-01-0${n}` })
    );
    mockFolderListResponse(before);
    const { result } = renderHook(() => useFolderSections(), { wrapper: Wrapper });

    await waitFor(() =>
      expect(result.current.recentFolderList.map((f) => f.id)).toEqual(['f4', 'f3', 'f2'])
    );

    // f1이 방금 저장돼 가장 최근이 됨 — 새로고침 없이, 같은 마운트에서 갱신돼야 한다.
    const after = before.map((f) => (f.id === 'f1' ? { ...f, lastUsedAt: '2099-01-01' } : f));
    mockFolderListResponse(after);
    await act(async () => {
      bookmarkFolderInvalidateQueries.list(queryClient);
    });

    await waitFor(() =>
      expect(result.current.recentFolderList.map((f) => f.id)).toEqual(['f1', 'f4', 'f3'])
    );
  });

  it('저장 이력 3개짜리 폴더가 4번째로 늘면 마운트 중에 구획이 등장한다', async () => {
    const threeFolders = [1, 2, 3].map((n) =>
      makeFolder({ id: `f${n}`, lastUsedAt: `2025-01-0${n}` })
    );
    mockFolderListResponse(threeFolders);
    const { result } = renderHook(() => useFolderSections(), { wrapper: Wrapper });

    // 정확히 3개(완전 일치)일 때는 안 뜬다.
    await waitFor(() => expect(result.current.folderList?.length).toBe(3));
    expect(result.current.recentFolderList).toEqual([]);

    const fourFolders = [...threeFolders, makeFolder({ id: 'f4', lastUsedAt: '2025-01-04' })];
    mockFolderListResponse(fourFolders);
    await act(async () => {
      bookmarkFolderInvalidateQueries.list(queryClient);
    });

    await waitFor(() =>
      expect(result.current.recentFolderList.map((f) => f.id)).toEqual(['f4', 'f3', 'f2'])
    );
  });

  it('폴더가 4개에서 3개로(완전 일치) 줄면 구획이 사라진다', async () => {
    const fourFolders = [1, 2, 3, 4].map((n) =>
      makeFolder({ id: `f${n}`, lastUsedAt: `2025-01-0${n}` })
    );
    mockFolderListResponse(fourFolders);
    const { result } = renderHook(() => useFolderSections(), { wrapper: Wrapper });

    await waitFor(() =>
      expect(result.current.recentFolderList.map((f) => f.id)).toEqual(['f4', 'f3', 'f2'])
    );

    // f4 폴더가 삭제됨 — 남은 3개가 완전 일치가 되어 구획이 사라져야 한다.
    const threeFolders = fourFolders.filter((f) => f.id !== 'f4');
    mockFolderListResponse(threeFolders);
    await act(async () => {
      bookmarkFolderInvalidateQueries.list(queryClient);
    });

    await waitFor(() => expect(result.current.folderList?.length).toBe(3));
    expect(result.current.recentFolderList).toEqual([]);
  });
});
