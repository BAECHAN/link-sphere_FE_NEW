import { createElement, type ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { createTestQueryClient } from '@/test/utils';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { UNDO_TOAST_DURATION_MS } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { useAuthStore } from '@/shared/store/auth.store';
import { usePostCardBookmarkFolderDialog } from '@/features/bookmark/toggle/hooks/usePostCardBookmarkFolderDialog';
import type {
  BookmarkFolder,
  BookmarkFoldersResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

// 토스트 "보기"가 어느 폴더로 보내는지 확인한다
const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

// 토스트 인자를 캡처해 action.onClick을 직접 호출한다
vi.mock('@/shared/lib/toast/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const POST_ID = 'post-uuid-1';
const FOLDER_A = 'folder-uuid-a';
const FOLDER_B = 'folder-uuid-b';

const folderA: BookmarkFolder = { id: FOLDER_A, name: '개발', sortOrder: 0, bookmarkCount: 2 };
const folderB: BookmarkFolder = {
  id: FOLDER_B,
  name: '나중에 읽기',
  sortOrder: 1,
  bookmarkCount: 4,
};

type HookProps = Parameters<typeof usePostCardBookmarkFolderDialog>[0];

function renderDialogHook(overrides: Partial<HookProps> = {}) {
  const onOpenChange = vi.fn();
  const queryClient = createTestQueryClient();
  const initialProps: HookProps = {
    postId: POST_ID,
    isBookmarked: true,
    bookmarkFolderIds: [FOLDER_A],
    open: true,
    onOpenChange,
    ...overrides,
  };
  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);
  const rendered = renderHook((props: HookProps) => usePostCardBookmarkFolderDialog(props), {
    wrapper,
    initialProps,
  });

  return { ...rendered, onOpenChange, initialProps };
}

function envelope(data: unknown) {
  return HttpResponse.json({ status: 200, message: 'ok', data, timestamp: '' }, { status: 200 });
}

function foldersResponse(isBookmarked: boolean, folderIds: string[]): BookmarkFoldersResponse {
  return { postId: POST_ID, isBookmarked, folderIds };
}

function serverError() {
  return HttpResponse.json(
    { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
    { status: 500 }
  );
}

function notLoggedIn() {
  return HttpResponse.json(
    { status: 401, code: 'NOT_LOGGED_IN', message: 'unauthorized', timestamp: '' },
    { status: 401 }
  );
}

const putBookmark = (response: () => Response) =>
  http.put(url(API_ENDPOINTS.post.postBookmark(POST_ID)), response);
const deleteBookmark = (response: () => Response) =>
  http.delete(url(API_ENDPOINTS.post.postBookmark(POST_ID)), response);
const postFolder = (folderId: string, response: () => Response) =>
  http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, folderId)), response);
const deleteFolder = (folderId: string, response: () => Response) =>
  http.delete(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, folderId)), response);
const clearFolders = (response: () => Response) =>
  http.delete(url(API_ENDPOINTS.bookmark.postFolders(POST_ID)), response);

interface CapturedAction {
  label: string;
  onClick: () => void;
}

function lastSuccessToast() {
  const calls = vi.mocked(toast.success).mock.calls;
  const [message, options] = calls[calls.length - 1]!;
  const action = options?.action as unknown as CapturedAction | undefined;

  return { message, options, action, argCount: calls[calls.length - 1]!.length };
}

function expectViewAction(folderKey: string) {
  const { options, action } = lastSuccessToast();

  expect(action?.label).toBe(TEXTS.bookmark.folder.viewAction);
  expect(options?.closeButton).toBe(false);

  action?.onClick();

  expect(navigateSpy).toHaveBeenCalledWith(`${ROUTES_PATHS.BOOKMARK}?folder=${folderKey}`);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('usePostCardBookmarkFolderDialog', () => {
  describe('wasBookmarkedOnOpen (열린 시점 북마크 여부 스냅샷)', () => {
    it('처음에는 넘겨받은 북마크 여부를 그대로 가진다', () => {
      const bookmarked = renderDialogHook({ isBookmarked: true });
      const notBookmarked = renderDialogHook({ isBookmarked: false });

      expect(bookmarked.result.current.wasBookmarkedOnOpen).toBe(true);
      expect(notBookmarked.result.current.wasBookmarkedOnOpen).toBe(false);
    });

    it('열려 있는 동안 북마크 여부가 바뀌어도 연 시점 값을 유지한다', () => {
      const { result, rerender, initialProps } = renderDialogHook({ isBookmarked: false });

      rerender({ ...initialProps, isBookmarked: true });

      expect(result.current.wasBookmarkedOnOpen).toBe(false);
    });

    it('닫힌 상태에서 북마크 여부가 바뀌거나 닫히는 순간에는 값을 갱신하지 않고, 다시 열릴 때 새로 반영한다', () => {
      const { result, rerender, initialProps } = renderDialogHook({
        isBookmarked: false,
        open: true,
      });

      // 닫히는 순간에는 저장 중 낙관적 갱신으로 바뀐 값을 가져오지 않는다
      rerender({ ...initialProps, isBookmarked: true, open: false });
      expect(result.current.wasBookmarkedOnOpen).toBe(false);

      rerender({ ...initialProps, isBookmarked: true, open: true });
      expect(result.current.wasBookmarkedOnOpen).toBe(true);
    });

    it('닫힌 채로 시작해도 열리는 순간의 북마크 여부를 잡는다', () => {
      const { result, rerender, initialProps } = renderDialogHook({
        isBookmarked: false,
        open: false,
      });

      rerender({ ...initialProps, isBookmarked: true, open: false });
      expect(result.current.wasBookmarkedOnOpen).toBe(false);

      rerender({ ...initialProps, isBookmarked: true, open: true });
      expect(result.current.wasBookmarkedOnOpen).toBe(true);
    });
  });

  describe('handleSelectUncategorized (미분류 탭)', () => {
    it('미북마크 상태면 미분류로 저장하고 안내 후 모달을 닫는다', async () => {
      let putCalled = false;
      server.use(
        putBookmark(() => {
          putCalled = true;
          return envelope(foldersResponse(true, []));
        })
      );
      const { result, onOpenChange } = renderDialogHook({
        isBookmarked: false,
        bookmarkFolderIds: [],
      });

      await act(async () => {
        await result.current.handleSelectUncategorized();
      });

      expect(putCalled).toBe(true);
      expect(lastSuccessToast().message).toBe(
        TEXTS.messages.success.bookmarkSavedTo(TEXTS.bookmark.folder.uncategorized)
      );
      expectViewAction('uncategorized');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('서버에 이미 다른 폴더 소속이 있었다면 그 사실을 알리고 보기는 전체 북마크로 보낸다', async () => {
      server.use(putBookmark(() => envelope(foldersResponse(true, [FOLDER_A]))));
      const { result, onOpenChange } = renderDialogHook({
        isBookmarked: false,
        bookmarkFolderIds: [],
      });

      await act(async () => {
        await result.current.handleSelectUncategorized();
      });

      expect(lastSuccessToast().message).toBe(TEXTS.messages.success.bookmarkAlreadyInOtherFolders);
      expectViewAction('all');
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('폴더 소속이 있으면 전체 해제하고 보기는 미분류로 보낸다', async () => {
      let clearCalled = false;
      server.use(
        clearFolders(() => {
          clearCalled = true;
          return envelope(foldersResponse(true, []));
        })
      );
      const { result, onOpenChange } = renderDialogHook({
        isBookmarked: true,
        bookmarkFolderIds: [FOLDER_A, FOLDER_B],
      });

      await act(async () => {
        await result.current.handleSelectUncategorized();
      });

      expect(clearCalled).toBe(true);
      expect(lastSuccessToast().message).toBe(TEXTS.messages.success.bookmarkClearedAllFolders);
      expectViewAction('uncategorized');
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('이미 미분류인 상태에서 탭하면 북마크를 완전 삭제하고 되돌리기를 제공한다', async () => {
      const requests: string[] = [];
      server.use(
        deleteBookmark(() => {
          requests.push('DELETE');
          return envelope(foldersResponse(false, []));
        }),
        putBookmark(() => {
          requests.push('PUT');
          return envelope(foldersResponse(true, []));
        })
      );
      const { result, onOpenChange } = renderDialogHook({
        isBookmarked: true,
        bookmarkFolderIds: [],
      });

      await act(async () => {
        await result.current.handleSelectUncategorized();
      });

      expect(requests).toEqual(['DELETE']);
      const { message, action } = lastSuccessToast();
      expect(message).toBe(TEXTS.messages.success.bookmarkRemoved);
      expect(action?.label).toBe(TEXTS.bookmark.folder.undoAction);
      expect(onOpenChange).toHaveBeenCalledWith(false);

      action?.onClick();

      await waitFor(() => expect(requests).toEqual(['DELETE', 'PUT']));
    });

    it('저장에 실패하면 에러 토스트만 띄우고 모달을 닫지 않는다', async () => {
      server.use(putBookmark(serverError));
      const { result, onOpenChange } = renderDialogHook({
        isBookmarked: false,
        bookmarkFolderIds: [],
      });

      await act(async () => {
        await result.current.handleSelectUncategorized();
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.bookmarkSaveFailed);
      expect(toast.success).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('응답을 못 받았으면 실패라고 단정하지 않는다', async () => {
      server.use(putBookmark(() => HttpResponse.error()));
      const { result, onOpenChange } = renderDialogHook({
        isBookmarked: false,
        bookmarkFolderIds: [],
      });

      await act(async () => {
        await result.current.handleSelectUncategorized();
      });

      expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.outcomeUnknown);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('로그인이 만료돼 끝났으면 토스트 없이 모달도 그대로 둔다', async () => {
      useAuthStore.getState().expireSession('/');
      server.use(putBookmark(notLoggedIn));
      const { result, onOpenChange } = renderDialogHook({
        isBookmarked: false,
        bookmarkFolderIds: [],
      });

      await act(async () => {
        await result.current.handleSelectUncategorized();
      });

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('handleSelectFolder (폴더 탭)', () => {
    it('비소속 폴더를 탭하면 추가하고, 보기는 그 폴더로 보낸다', async () => {
      let addCalled = false;
      server.use(
        postFolder(FOLDER_B, () => {
          addCalled = true;
          return envelope(foldersResponse(true, [FOLDER_A, FOLDER_B]));
        })
      );
      const { result, onOpenChange } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderB);
      });

      expect(addCalled).toBe(true);
      expect(lastSuccessToast().message).toBe(
        TEXTS.messages.success.bookmarkSavedTo('나중에 읽기')
      );
      expectViewAction(FOLDER_B);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('다른 폴더도 있는 소속 폴더를 탭하면 그 폴더에서만 빼고, 되돌리기 없이 안내만 한다', async () => {
      let removeCalled = false;
      server.use(
        deleteFolder(FOLDER_A, () => {
          removeCalled = true;
          return envelope(foldersResponse(true, [FOLDER_B]));
        })
      );
      const { result, onOpenChange } = renderDialogHook({
        bookmarkFolderIds: [FOLDER_A, FOLDER_B],
      });

      await act(async () => {
        await result.current.handleSelectFolder(folderA);
      });

      expect(removeCalled).toBe(true);
      const { message, options, argCount } = lastSuccessToast();
      expect(message).toBe(TEXTS.messages.success.bookmarkRemovedFromFolder('개발'));
      expect(options).toBeUndefined();
      expect(argCount).toBe(1);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('마지막 폴더를 탭해 북마크까지 지워졌으면 설명과 되돌리기를 제공하고, 되돌리기는 같은 폴더를 다시 추가한다', async () => {
      let restoreCalled = false;
      server.use(deleteFolder(FOLDER_A, () => envelope(foldersResponse(false, []))));
      const { result, onOpenChange } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderA);
      });

      const { message, options, action } = lastSuccessToast();
      expect(message).toBe(TEXTS.messages.success.bookmarkRemovedFromFolder('개발'));
      expect(options?.description).toBe(
        TEXTS.messages.success.bookmarkRemovedWithLastFolderDescription
      );
      expect(options?.closeButton).toBe(false);
      expect(options?.duration).toBe(UNDO_TOAST_DURATION_MS);
      expect(action?.label).toBe(TEXTS.bookmark.folder.undoAction);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);

      server.use(
        postFolder(FOLDER_A, () => {
          restoreCalled = true;
          return envelope(foldersResponse(true, [FOLDER_A]));
        })
      );
      action?.onClick();

      await waitFor(() => expect(restoreCalled).toBe(true));
    });

    it('마지막 폴더였어도 서버에 다른 소속이 남아 있으면 일반 제거 안내만 한다', async () => {
      server.use(deleteFolder(FOLDER_A, () => envelope(foldersResponse(true, [FOLDER_B]))));
      const { result, onOpenChange } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderA);
      });

      const { message, options, argCount } = lastSuccessToast();
      expect(message).toBe(TEXTS.messages.success.bookmarkRemovedFromFolder('개발'));
      expect(options).toBeUndefined();
      expect(argCount).toBe(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('되돌리기가 실패하면 닫을 때까지 남는 에러 토스트를 띄운다', async () => {
      server.use(deleteFolder(FOLDER_A, () => envelope(foldersResponse(false, []))));
      const { result } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderA);
      });

      server.use(postFolder(FOLDER_A, serverError));
      lastSuccessToast().action?.onClick();

      await waitFor(() =>
        expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.bookmarkRestoreFailed, {
          id: 'bookmark-restore-error',
          duration: Infinity,
        })
      );
    });

    it('되돌리기 도중 로그인이 만료됐으면 에러 토스트를 띄우지 않는다', async () => {
      server.use(deleteFolder(FOLDER_A, () => envelope(foldersResponse(false, []))));
      const { result } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderA);
      });

      let restoreCalled = false;
      useAuthStore.getState().expireSession('/');
      server.use(
        postFolder(FOLDER_A, () => {
          restoreCalled = true;
          return notLoggedIn();
        })
      );
      lastSuccessToast().action?.onClick();

      await waitFor(() => expect(restoreCalled).toBe(true));
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      expect(toast.error).not.toHaveBeenCalled();
    });

    it('비소속 폴더 추가가 실패하면 저장 실패 문구를 띄우고 모달을 닫지 않는다', async () => {
      server.use(postFolder(FOLDER_B, serverError));
      // 소속이 하나뿐이어도 탭한 폴더가 비소속이면 "마지막 폴더 제거"가 아니다
      const { result, onOpenChange } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderB);
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.bookmarkSaveFailed);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('다른 폴더도 있는 소속 폴더 제거가 실패하면 폴더 제거 실패 문구를 띄운다', async () => {
      server.use(deleteFolder(FOLDER_A, serverError));
      const { result, onOpenChange } = renderDialogHook({
        bookmarkFolderIds: [FOLDER_A, FOLDER_B],
      });

      await act(async () => {
        await result.current.handleSelectFolder(folderA);
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.bookmarkRemoveFromFolderFailed);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('마지막 폴더 제거가 실패하면 북마크 제거 실패 문구를 띄운다', async () => {
      server.use(deleteFolder(FOLDER_A, serverError));
      const { result, onOpenChange } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderA);
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.bookmarkRemoveFailed);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('응답을 못 받았으면 실패라고 단정하지 않는다', async () => {
      server.use(postFolder(FOLDER_B, () => HttpResponse.error()));
      const { result, onOpenChange } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderB);
      });

      expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.outcomeUnknown);
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('로그인이 만료돼 끝났으면 토스트 없이 모달도 그대로 둔다', async () => {
      useAuthStore.getState().expireSession('/');
      server.use(postFolder(FOLDER_B, notLoggedIn));
      const { result, onOpenChange } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleSelectFolder(folderB);
      });

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('handleRemove (북마크 제거)', () => {
    it('소속이 없던 북마크를 지우면 되돌리기를 제공하고, 되돌리기는 저장(PUT)을 보낸다', async () => {
      const requests: string[] = [];
      server.use(
        deleteBookmark(() => {
          requests.push('DELETE');
          return envelope(foldersResponse(false, []));
        }),
        putBookmark(() => {
          requests.push('PUT');
          return envelope(foldersResponse(true, []));
        })
      );
      const { result, onOpenChange } = renderDialogHook({ bookmarkFolderIds: [] });

      await act(async () => {
        await result.current.handleRemove();
      });

      const { message, options, action } = lastSuccessToast();
      expect(message).toBe(TEXTS.messages.success.bookmarkRemoved);
      expect(action?.label).toBe(TEXTS.bookmark.folder.undoAction);
      expect(options?.closeButton).toBe(false);
      expect(options?.duration).toBe(UNDO_TOAST_DURATION_MS);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);

      action?.onClick();

      await waitFor(() => expect(requests).toEqual(['DELETE', 'PUT']));
    });

    it('소속 폴더가 하나였으면 되돌리기가 그 폴더를 다시 추가한다', async () => {
      let restoreCalled = false;
      server.use(deleteBookmark(() => envelope(foldersResponse(false, []))));
      const { result } = renderDialogHook({ bookmarkFolderIds: [FOLDER_A] });

      await act(async () => {
        await result.current.handleRemove();
      });

      const { action } = lastSuccessToast();
      expect(action?.label).toBe(TEXTS.bookmark.folder.undoAction);

      server.use(
        postFolder(FOLDER_A, () => {
          restoreCalled = true;
          return envelope(foldersResponse(true, [FOLDER_A]));
        })
      );
      action?.onClick();

      await waitFor(() => expect(restoreCalled).toBe(true));
    });

    it('소속 폴더가 여럿이면 되돌리기 없이 안내만 하고 모달을 닫는다', async () => {
      server.use(deleteBookmark(() => envelope(foldersResponse(false, []))));
      const { result, onOpenChange } = renderDialogHook({
        bookmarkFolderIds: [FOLDER_A, FOLDER_B],
      });

      await act(async () => {
        await result.current.handleRemove();
      });

      const { message, options, argCount } = lastSuccessToast();
      expect(message).toBe(TEXTS.messages.success.bookmarkRemoved);
      expect(options).toBeUndefined();
      expect(argCount).toBe(1);
      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it('제거에 실패하면 에러 토스트만 띄우고 모달을 닫지 않는다', async () => {
      server.use(deleteBookmark(serverError));
      const { result, onOpenChange } = renderDialogHook();

      await act(async () => {
        await result.current.handleRemove();
      });

      expect(toast.error).toHaveBeenCalledTimes(1);
      expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.bookmarkRemoveFailed);
      expect(toast.success).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('로그인이 만료돼 끝났으면 토스트 없이 모달도 그대로 둔다', async () => {
      useAuthStore.getState().expireSession('/');
      server.use(deleteBookmark(notLoggedIn));
      const { result, onOpenChange } = renderDialogHook();

      await act(async () => {
        await result.current.handleRemove();
      });

      expect(toast.error).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
