import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import dayjs from 'dayjs';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { createTestQueryClient } from '@/test/utils';
import { API_ENDPOINTS, API_BASE_URL } from '@/shared/config/api';
import { bookmarkFolderKeys } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import type {
  BookmarkFolder,
  BookmarkFolderListResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import {
  UNCATEGORIZED_PENDING_KEY,
  useBookmarkFolderSelect,
} from '@/features/bookmark/select/hooks/useBookmarkFolderSelect';

function folder(id: string, overrides: Partial<BookmarkFolder> = {}): BookmarkFolder {
  return { id, name: `폴더-${id}`, sortOrder: 0, bookmarkCount: 1, ...overrides };
}

function mockListResponse(data: BookmarkFolderListResponse) {
  server.use(
    http.get(`${API_BASE_URL}${API_ENDPOINTS.bookmark.folders}`, () =>
      HttpResponse.json({ status: 200, message: 'ok', data, timestamp: '' }, { status: 200 })
    )
  );
}

function mockListFailure() {
  server.use(
    http.get(`${API_BASE_URL}${API_ENDPOINTS.bookmark.folders}`, () =>
      HttpResponse.json(
        { status: 500, message: 'fail', data: null, timestamp: '' },
        { status: 500 }
      )
    )
  );
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

interface HookProps {
  open: boolean;
  isBookmarked: boolean;
  selectedFolderIds: string[];
}

function setup(
  initial: Partial<HookProps> = {},
  callbacks: {
    onUncategorized?: () => Promise<void> | void;
    onFolder?: (f: BookmarkFolder) => Promise<void> | void;
  } = {}
) {
  const queryClient = createTestQueryClient();
  const onSelectUncategorized = vi.fn(callbacks.onUncategorized ?? (() => undefined));
  const onSelectFolder = vi.fn(callbacks.onFolder ?? (() => undefined));
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const hook = renderHook(
    (props: HookProps) =>
      useBookmarkFolderSelect({ ...props, onSelectUncategorized, onSelectFolder }),
    {
      wrapper,
      initialProps: { open: true, isBookmarked: false, selectedFolderIds: [], ...initial },
    }
  );

  return { ...hook, queryClient, onSelectUncategorized, onSelectFolder };
}

describe('useBookmarkFolderSelect', () => {
  describe('폴더 목록', () => {
    it('받는 중에는 기다리는 상태이고 실패로 보이지 않는다', () => {
      mockListResponse({ folders: [], uncategorizedCount: 0 });
      const { result } = setup();

      expect(result.current.isPending).toBe(true);
      expect(result.current.isFolderListFailed).toBe(false);
    });

    it('받은 목록은 고정한 폴더를 맨 위로 올리고 미분류 개수를 함께 돌려준다', async () => {
      mockListResponse({
        folders: [
          folder('a', { sortOrder: 0 }),
          folder('b', { sortOrder: 1, pinnedAt: dayjs('2026-10-01').format() }),
        ],
        uncategorizedCount: 7,
      });
      const { result } = setup();

      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(result.current.folderList.map((f) => f.id)).toEqual(['b', 'a']);
      expect(result.current.uncategorizedCount).toBe(7);
      expect(result.current.isFolderListFailed).toBe(false);
    });

    it('응답의 folders가 배열이 아니면 빈 목록으로 처리한다', async () => {
      server.use(
        http.get(`${API_BASE_URL}${API_ENDPOINTS.bookmark.folders}`, () =>
          HttpResponse.json(
            { status: 200, message: 'ok', data: { folders: '<html>' }, timestamp: '' },
            { status: 200 }
          )
        )
      );
      const { result } = setup();

      await waitFor(() => expect(result.current.isPending).toBe(false));

      expect(result.current.folderList).toEqual([]);
      expect(result.current.uncategorizedCount).toBe(0);
    });

    it('저장 이력이 있는 폴더가 충분하면 최근 저장한 폴더를 최신순으로 돌려준다', async () => {
      mockListResponse({
        folders: [
          folder('a', { lastUsedAt: dayjs('2026-10-01').format() }),
          folder('b', { lastUsedAt: dayjs('2026-10-03').format() }),
          folder('c', { lastUsedAt: dayjs('2026-10-02').format() }),
          folder('d'),
        ],
        uncategorizedCount: 0,
      });
      const { result } = setup();

      await waitFor(() => expect(result.current.recentFolderList).toHaveLength(3));

      expect(result.current.recentFolderList.map((f) => f.id)).toEqual(['b', 'c', 'a']);
    });

    it('닫혀 있는 동안에는 목록을 요청하지 않고 열리면 요청한다', async () => {
      const requested = vi.fn();

      server.use(
        http.get(`${API_BASE_URL}${API_ENDPOINTS.bookmark.folders}`, () => {
          requested();

          return HttpResponse.json(
            {
              status: 200,
              message: 'ok',
              data: { folders: [], uncategorizedCount: 0 },
              timestamp: '',
            },
            { status: 200 }
          );
        })
      );
      const { result, rerender } = setup({ open: false });

      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(requested).not.toHaveBeenCalled();
      expect(result.current.isPending).toBe(true);

      rerender({ open: true, isBookmarked: false, selectedFolderIds: [] });

      await waitFor(() => expect(result.current.isPending).toBe(false));
      expect(requested).toHaveBeenCalledTimes(1);
    });

    it('한 번도 받지 못하고 실패하면 실패로 알리고, 다시 시도하면 목록을 받는다', async () => {
      mockListFailure();
      const { result } = setup();

      await waitFor(() => expect(result.current.isFolderListFailed).toBe(true));

      mockListResponse({ folders: [folder('a')], uncategorizedCount: 2 });
      act(() => {
        result.current.retryFolderList();
      });

      await waitFor(() => expect(result.current.isFolderListFailed).toBe(false));
      expect(result.current.folderList.map((f) => f.id)).toEqual(['a']);
      expect(result.current.uncategorizedCount).toBe(2);
    });

    it('받아 둔 목록이 있으면 다시 받기가 실패해도 실패로 알리지 않고 그 목록을 보인다', async () => {
      mockListResponse({ folders: [folder('a')], uncategorizedCount: 0 });
      const { result, queryClient } = setup();

      await waitFor(() => expect(result.current.isPending).toBe(false));

      mockListFailure();
      act(() => {
        result.current.retryFolderList();
      });

      await waitFor(() =>
        expect(queryClient.getQueryState(bookmarkFolderKeys.list)?.status).toBe('error')
      );

      expect(result.current.isFolderListFailed).toBe(false);
      expect(result.current.folderList.map((f) => f.id)).toEqual(['a']);
    });
  });

  describe('미분류 선택 표시', () => {
    it.each([
      { isBookmarked: true, selectedFolderIds: [], expected: true },
      { isBookmarked: true, selectedFolderIds: ['a'], expected: false },
      { isBookmarked: false, selectedFolderIds: [], expected: false },
      { isBookmarked: false, selectedFolderIds: ['a'], expected: false },
    ])(
      '북마크=$isBookmarked, 선택 폴더=$selectedFolderIds 이면 미분류 선택은 $expected다',
      ({ isBookmarked, selectedFolderIds, expected }) => {
        const { result } = setup({ isBookmarked, selectedFolderIds });

        expect(result.current.isUncategorizedSelected).toBe(expected);
      }
    );
  });

  describe('행 선택', () => {
    it('미분류를 고르면 처리 중에는 미분류 키로 잠기고 끝나면 풀린다', async () => {
      const pending = deferred();
      const { result, onSelectUncategorized } = setup(
        {},
        { onUncategorized: () => pending.promise }
      );

      expect(result.current.pendingKey).toBeNull();
      expect(result.current.isAnyPending).toBe(false);

      let done!: Promise<void>;

      act(() => {
        done = result.current.handleSelectUncategorized();
      });

      expect(onSelectUncategorized).toHaveBeenCalledTimes(1);
      expect(result.current.pendingKey).toBe(UNCATEGORIZED_PENDING_KEY);
      expect(result.current.isAnyPending).toBe(true);

      await act(async () => {
        pending.resolve();
        await done;
      });

      expect(result.current.pendingKey).toBeNull();
      expect(result.current.isAnyPending).toBe(false);
    });

    it('폴더를 고르면 그 폴더를 넘기고 처리 중에는 폴더 id로 잠기고 끝나면 풀린다', async () => {
      const pending = deferred();
      const target = folder('x');
      const { result, onSelectFolder } = setup({}, { onFolder: () => pending.promise });
      let done!: Promise<void>;

      act(() => {
        done = result.current.handleSelectFolder(target);
      });

      expect(onSelectFolder).toHaveBeenCalledWith(target);
      expect(result.current.pendingKey).toBe('x');
      expect(result.current.isAnyPending).toBe(true);

      await act(async () => {
        pending.resolve();
        await done;
      });

      expect(result.current.pendingKey).toBeNull();
    });

    it('처리가 실패해도 잠금은 풀리고 오류는 호출부로 전해진다', async () => {
      const pending = deferred();
      const { result } = setup({}, { onFolder: () => pending.promise });
      let done!: Promise<void>;

      act(() => {
        done = result.current.handleSelectFolder(folder('x'));
      });

      await act(async () => {
        pending.reject(new Error('저장 실패'));
        await expect(done).rejects.toThrow('저장 실패');
      });

      expect(result.current.pendingKey).toBeNull();
    });

    it('미분류 처리가 실패해도 잠금은 풀린다', async () => {
      const pending = deferred();
      const { result } = setup({}, { onUncategorized: () => pending.promise });
      let done!: Promise<void>;

      act(() => {
        done = result.current.handleSelectUncategorized();
      });

      await act(async () => {
        pending.reject(new Error('저장 실패'));
        await expect(done).rejects.toThrow('저장 실패');
      });

      expect(result.current.pendingKey).toBeNull();
    });

    it('폴더 처리 중에는 다른 폴더·미분류 선택을 무시한다', async () => {
      const pending = deferred();
      const { result, onSelectFolder, onSelectUncategorized } = setup(
        {},
        { onFolder: () => pending.promise }
      );
      let done!: Promise<void>;

      act(() => {
        done = result.current.handleSelectFolder(folder('first'));
      });

      await act(async () => {
        await result.current.handleSelectFolder(folder('second'));
        await result.current.handleSelectUncategorized();
      });

      expect(onSelectFolder).toHaveBeenCalledTimes(1);
      expect(onSelectUncategorized).not.toHaveBeenCalled();
      expect(result.current.pendingKey).toBe('first');

      await act(async () => {
        pending.resolve();
        await done;
      });
    });

    it('미분류 처리 중에는 폴더·미분류 선택을 무시하고 끝나면 다시 고를 수 있다', async () => {
      const pending = deferred();
      const { result, onSelectFolder, onSelectUncategorized } = setup(
        {},
        { onUncategorized: () => pending.promise }
      );
      let done!: Promise<void>;

      act(() => {
        done = result.current.handleSelectUncategorized();
      });

      await act(async () => {
        await result.current.handleSelectUncategorized();
        await result.current.handleSelectFolder(folder('second'));
      });

      expect(onSelectUncategorized).toHaveBeenCalledTimes(1);
      expect(onSelectFolder).not.toHaveBeenCalled();
      expect(result.current.pendingKey).toBe(UNCATEGORIZED_PENDING_KEY);

      await act(async () => {
        pending.resolve();
        await done;
      });

      await act(async () => {
        await result.current.handleSelectFolder(folder('second'));
      });

      expect(onSelectFolder).toHaveBeenCalledTimes(1);
    });
  });

  describe('새 폴더 입력', () => {
    it('닫히면 펼쳐 둔 입력을 접는다', () => {
      const { result, rerender } = setup();

      act(() => {
        result.current.setCreatingMode(true);
      });
      expect(result.current.creatingMode).toBe(true);

      rerender({ open: false, isBookmarked: false, selectedFolderIds: [] });
      expect(result.current.creatingMode).toBe(false);
    });

    it('열려 있는 동안 다른 값이 바뀌어도 펼친 입력은 유지된다', () => {
      const { result, rerender } = setup();

      act(() => {
        result.current.setCreatingMode(true);
      });
      rerender({ open: true, isBookmarked: true, selectedFolderIds: ['a'] });

      expect(result.current.creatingMode).toBe(true);
    });

    it('만들기를 취소하면 입력을 접는다', () => {
      const { result } = setup();

      act(() => {
        result.current.setCreatingMode(true);
      });
      act(() => {
        result.current.handleCancelCreate();
      });

      expect(result.current.creatingMode).toBe(false);
    });

    it('폴더를 만들면 저장 처리가 끝나기 전에 입력을 접고 그 폴더를 고른다', async () => {
      const pending = deferred();
      const created = folder('new');
      const { result, onSelectFolder } = setup({}, { onFolder: () => pending.promise });
      let done!: Promise<void>;

      act(() => {
        result.current.setCreatingMode(true);
      });
      act(() => {
        done = result.current.handleFolderCreated(created);
      });

      expect(result.current.creatingMode).toBe(false);
      expect(onSelectFolder).toHaveBeenCalledWith(created);
      expect(result.current.pendingKey).toBe('new');

      await act(async () => {
        pending.resolve();
        await done;
      });

      expect(result.current.pendingKey).toBeNull();
    });
  });
});
