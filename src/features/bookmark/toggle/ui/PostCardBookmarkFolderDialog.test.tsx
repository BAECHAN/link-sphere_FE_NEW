import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { toast } from '@/shared/lib/toast/toast';
import {
  PostCardBookmarkFolderDialog,
  type BookmarkFolderSelectRenderProps,
} from '@/features/bookmark/toggle/ui/PostCardBookmarkFolderDialog';
import { BookmarkFolderSelectDialog } from '@/features/bookmark/select/ui/BookmarkFolderSelectDialog';
import type {
  BookmarkFoldersResponse,
  BookmarkFolderListResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

// PostCardBookmarkFolderDialog는 공통 프레젠테이션(features/bookmark/select/ui/BookmarkFolderSelectDialog)에
// 얇게 위임하므로, 아래 케이스들은 BookmarkFolderSelectDialog의 행 렌더링·최근 구획도 함께 검증한다.
// 실제 앱에서 PostCard가 하는 것처럼 renderFolderSelect로 진짜 창을 넘긴다(docs/FE-ARCHITECTURE.md §26).
function renderFolderSelect(props: BookmarkFolderSelectRenderProps) {
  return <BookmarkFolderSelectDialog {...props} />;
}

// 데스크탑 모달 스타일로 고정 — matchMedia 스텁만으로는 useIsMobile 값이 effect 이후에나 정해져 불안정하다
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

// 열린 직후 400ms 클릭 가드(useOpenClickGuard) — 기본은 비활성(false)으로 목킹해 기존
// 테스트들의 "열자마자 행 클릭" 시퀀스를 그대로 통과시킨다. 가드 자체의 동작은 아래
// "열린 직후 400ms 안의 탭은 무시한다" 테스트에서만 true로 전환해 검증한다.
const { mockIsOpenClickGuarded } = vi.hoisted(() => ({
  mockIsOpenClickGuarded: vi.fn(() => false),
}));
vi.mock('@/shared/hooks/useOpenClickGuard', () => ({
  useOpenClickGuard: () => mockIsOpenClickGuarded,
}));

// renderWithProviders에는 <Toaster />가 없어 되돌리기 버튼을 실제로 클릭할 수 없다 —
// toast.success 호출 인자를 캡처해 action.onClick을 직접 호출하는 방식으로 검증한다.
vi.mock('@/shared/lib/toast/toast', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const POST_ID = 'post-uuid-1';
const FOLDER_A = 'folder-uuid-a';
const FOLDER_B = 'folder-uuid-b';

const folderListResponse: BookmarkFolderListResponse = {
  folders: [
    { id: FOLDER_A, name: '개발', sortOrder: 0, bookmarkCount: 2 },
    {
      id: FOLDER_B,
      name: '나중에 읽기',
      sortOrder: 1,
      bookmarkCount: 4,
    },
  ],
  uncategorizedCount: 1,
};

function renderDialog(
  props: Partial<React.ComponentProps<typeof PostCardBookmarkFolderDialog>> = {}
) {
  const onOpenChange = vi.fn();
  const result = renderWithProviders(
    <PostCardBookmarkFolderDialog
      postId={POST_ID}
      isBookmarked
      bookmarkFolderIds={[FOLDER_A]}
      open
      onOpenChange={onOpenChange}
      renderFolderSelect={renderFolderSelect}
      {...props}
    />
  );
  return { ...result, onOpenChange };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsOpenClickGuarded.mockReturnValue(false);
  server.use(
    http.get(url(API_ENDPOINTS.bookmark.folders), () =>
      HttpResponse.json(
        { status: 200, message: 'ok', data: folderListResponse, timestamp: '' },
        { status: 200 }
      )
    )
  );
});

function bookmarkFoldersResponse(folderIds: string[]): BookmarkFoldersResponse {
  return { postId: POST_ID, isBookmarked: true, folderIds };
}

describe('PostCardBookmarkFolderDialog', () => {
  it('목록을 기다리는 동안 고정 행을 비활성으로 먼저 그리고, 도착하면 실제 행으로 바뀐다', async () => {
    let resolveList: () => void = () => {};
    const listArrived = new Promise<void>((resolve) => {
      resolveList = resolve;
    });
    server.use(
      http.get(url(API_ENDPOINTS.bookmark.folders), async () => {
        await listArrived;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: folderListResponse, timestamp: '' },
          { status: 200 }
        );
      })
    );
    renderDialog();

    // 목록 없이 그릴 수 있는 행은 바로 보이되, 저장할 수 없으니 비활성이다(FolderListLoading)
    expect(screen.getByRole('button', { name: '새 폴더 만들기' })).toBeDisabled();
    expect(screen.getByRole('button', { name: /^미분류/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '북마크 제거' })).toBeDisabled();
    expect(screen.queryByText('개발')).not.toBeInTheDocument();

    resolveList();

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: '새 폴더 만들기' })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^미분류/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: '북마크 제거' })).toBeEnabled();
  });

  it('소속된 모든 폴더 행에 체크 표시가 뜬다', async () => {
    renderDialog({ bookmarkFolderIds: [FOLDER_A, FOLDER_B] });

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());

    const devRow = screen.getByText('개발').closest('button');
    const laterRow = screen.getByText('나중에 읽기').closest('button');
    expect(devRow?.querySelector('svg.lucide-check')).toBeTruthy();
    expect(laterRow?.querySelector('svg.lucide-check')).toBeTruthy();
  });

  it('열린 직후 400ms 안의 탭은 요청 없이 무시된다(더블클릭 관통 방지)', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_B)), () => {
        called = true;
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: bookmarkFoldersResponse([FOLDER_A, FOLDER_B]),
            timestamp: '',
          },
          { status: 200 }
        );
      })
    );
    renderDialog();

    await waitFor(() => expect(screen.getByText('나중에 읽기')).toBeInTheDocument());

    mockIsOpenClickGuarded.mockReturnValue(true);
    await user.click(screen.getByText('나중에 읽기'));

    expect(called).toBe(false);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    mockIsOpenClickGuarded.mockReturnValue(false);
    await user.click(screen.getByText('나중에 읽기'));

    await waitFor(() => expect(called).toBe(true));
  });

  it('비소속 폴더를 탭하면 추가 요청을 보내고 모달을 닫는다', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_B)), () => {
        called = true;
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: bookmarkFoldersResponse([FOLDER_A, FOLDER_B]),
            timestamp: '',
          },
          { status: 200 }
        );
      })
    );
    const { onOpenChange } = renderDialog();

    await waitFor(() => expect(screen.getByText('나중에 읽기')).toBeInTheDocument());
    await user.click(screen.getByText('나중에 읽기'));

    await waitFor(() => expect(called).toBe(true));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('다른 폴더도 있는 소속 폴더를 탭하면 그 폴더에서만 제거 요청을 보낸다', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () => {
        called = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: bookmarkFoldersResponse([FOLDER_B]), timestamp: '' },
          { status: 200 }
        );
      })
    );
    renderDialog({ bookmarkFolderIds: [FOLDER_A, FOLDER_B] });

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    await user.click(screen.getByText('개발'));

    await waitFor(() => expect(called).toBe(true));
    // 다른 폴더가 남아있으므로 되돌리기 없이 일반 제거 토스트만 뜬다
    expect(toast.success).toHaveBeenCalledWith('개발 폴더에서 제거했어요.');
  });

  it('마지막 폴더를 탭하면 폴더에서만 빼지 않고 북마크 자체를 완전 삭제하며 되돌리기를 제공한다', async () => {
    const user = userEvent.setup();
    let toggleCalled = false;
    let removeFolderCalled = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postBookmark(POST_ID)), () => {
        toggleCalled = true;
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () => {
        removeFolderCalled = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: bookmarkFoldersResponse([]), timestamp: '' },
          { status: 200 }
        );
      })
    );
    // 기본값 bookmarkFolderIds=[FOLDER_A] — 유일한 소속(마지막 폴더)
    renderDialog();

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    await user.click(screen.getByText('개발'));

    // 폴더에서만 제거하는 DELETE가 아니라 북마크 자체를 지우는 토글이 나가야 한다
    await waitFor(() => expect(toggleCalled).toBe(true));
    expect(removeFolderCalled).toBe(false);

    const [message, options] = vi.mocked(toast.success).mock.calls[0]!;
    expect(message).toBe('개발 폴더에서 제거했어요.');
    expect(options?.description).toBe('마지막 폴더라서 북마크도 함께 제거했어요.');
    const action = options?.action as unknown as { label: string; onClick: () => void };
    expect(action.label).toBe('되돌리기');

    // 되돌리기를 누르면 같은 폴더로 다시 추가하는 요청이 나간다
    let restoreCalled = false;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () => {
        restoreCalled = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: bookmarkFoldersResponse([FOLDER_A]), timestamp: '' },
          { status: 200 }
        );
      })
    );
    action.onClick();

    await waitFor(() => expect(restoreCalled).toBe(true));
  });

  it('체크된 미분류를 탭하면 북마크 자체를 완전 삭제하고 되돌리기를 제공한다', async () => {
    const user = userEvent.setup();
    let toggleCallCount = 0;
    let clearCalled = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postBookmark(POST_ID)), () => {
        toggleCallCount += 1;
        return new HttpResponse(null, { status: 204 });
      }),
      http.delete(url(API_ENDPOINTS.bookmark.postFolders(POST_ID)), () => {
        clearCalled = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: bookmarkFoldersResponse([]), timestamp: '' },
          { status: 200 }
        );
      })
    );
    renderDialog({ bookmarkFolderIds: [] });

    // 로딩 중에도 미분류 행이 비활성으로 먼저 보이므로(FolderListLoading) 활성화될 때까지 기다린다
    await waitFor(() => expect(screen.getByRole('button', { name: /^미분류/ })).toBeEnabled());
    await user.click(screen.getByText('미분류'));

    // 전체 해제(DELETE)가 아니라 북마크 자체를 지우는 토글이 나가야 한다
    await waitFor(() => expect(toggleCallCount).toBe(1));
    expect(clearCalled).toBe(false);

    const [message, options] = vi.mocked(toast.success).mock.calls[0]!;
    expect(message).toBe('북마크를 제거했어요.');
    const action = options?.action as unknown as { label: string; onClick: () => void };
    expect(action.label).toBe('되돌리기');

    // 되돌리기를 누르면 같은 엔드포인트(토글)로 다시 요청이 나가 미분류로 복원된다
    action.onClick();

    await waitFor(() => expect(toggleCallCount).toBe(2));
  });

  it('미북마크 상태에서 미분류를 탭하면 여전히 미분류로 저장된다 (생성)', async () => {
    const user = userEvent.setup();
    let toggleCalled = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postBookmark(POST_ID)), () => {
        toggleCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderDialog({ isBookmarked: false, bookmarkFolderIds: [] });

    // 로딩 중에도 미분류 행이 비활성으로 먼저 보이므로(FolderListLoading) 활성화될 때까지 기다린다
    await waitFor(() => expect(screen.getByRole('button', { name: /^미분류/ })).toBeEnabled());
    await user.click(screen.getByText('미분류'));

    await waitFor(() => expect(toggleCalled).toBe(true));

    const [message, options] = vi.mocked(toast.success).mock.calls[0]!;
    expect(message).toBe('미분류에 저장했어요.');
    const action = options?.action as unknown as { label: string };
    expect(action.label).toBe('보기');
  });

  it('소속 폴더가 있는 상태에서 미분류를 탭하면 여전히 전체 해제된다', async () => {
    const user = userEvent.setup();
    let clearCalled = false;
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.postFolders(POST_ID)), () => {
        clearCalled = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: bookmarkFoldersResponse([]), timestamp: '' },
          { status: 200 }
        );
      })
    );
    renderDialog({ bookmarkFolderIds: [FOLDER_A, FOLDER_B] });

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    await user.click(screen.getByText('미분류'));

    await waitFor(() => expect(clearCalled).toBe(true));

    const [message] = vi.mocked(toast.success).mock.calls[0]!;
    expect(message).toBe('모든 폴더에서 제거했어요.');
  });

  it('체크된 미분류 삭제가 실패하면 에러 토스트만 뜨고 모달이 닫히지 않는다', async () => {
    const user = userEvent.setup();
    server.use(
      http.post(url(API_ENDPOINTS.post.postBookmark(POST_ID)), () =>
        HttpResponse.json(
          { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
          { status: 500 }
        )
      )
    );
    const { onOpenChange } = renderDialog({ bookmarkFolderIds: [] });

    // 로딩 중에도 미분류 행이 비활성으로 먼저 보이므로(FolderListLoading) 활성화될 때까지 기다린다
    await waitFor(() => expect(screen.getByRole('button', { name: /^미분류/ })).toBeEnabled());
    await user.click(screen.getByText('미분류'));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith('북마크 제거에 실패했어요.'));
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('폴더가 1개 이상이면 "내 폴더" 구획 헤더가 뜬다 (최근 구획 임계값 미달이어도)', async () => {
    renderDialog();

    // folderListResponse는 폴더 2개뿐이라 최근 구획(6개 임계값)은 안 뜨지만, 내 폴더 헤더는 뜬다
    await waitFor(() => expect(screen.getByText('내 폴더')).toBeInTheDocument());
    expect(screen.queryByText('최근 저장한 폴더')).not.toBeInTheDocument();
  });

  it('북마크 제거 행을 누르면 토글(해제) 요청을 보낸다', async () => {
    const user = userEvent.setup();
    let toggleCalled = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postBookmark(POST_ID)), () => {
        toggleCalled = true;
        return new HttpResponse(null, { status: 204 });
      })
    );
    renderDialog();

    await waitFor(() => expect(screen.getByRole('button', { name: '북마크 제거' })).toBeEnabled());
    await user.click(screen.getByText('북마크 제거'));

    await waitFor(() => expect(toggleCalled).toBe(true));
  });

  describe('최근 저장한 폴더 (split menu 상단 구획)', () => {
    // 임계값: 폴더 6개 이상 + lastUsedAt 있는 폴더 3개 이상이어야 노출된다
    const RECENT_A = 'folder-uuid-recent-a';
    const manyFoldersResponse: BookmarkFolderListResponse = {
      folders: [
        {
          id: FOLDER_A,
          name: '개발',
          sortOrder: 0,
          bookmarkCount: 2,
        },
        {
          id: FOLDER_B,
          name: '나중에 읽기',
          sortOrder: 1,
          bookmarkCount: 4,
        },
        {
          id: RECENT_A,
          name: '최근폴더',
          sortOrder: 2,
          bookmarkCount: 1,
          lastUsedAt: '2025-01-05',
        },
        {
          id: 'folder-uuid-c',
          name: '디자인',
          sortOrder: 3,
          bookmarkCount: 0,
          lastUsedAt: '2025-01-04',
        },
        {
          id: 'folder-uuid-d',
          name: '읽을거리',
          sortOrder: 4,
          bookmarkCount: 0,
          lastUsedAt: '2025-01-03',
        },
        {
          id: 'folder-uuid-e',
          name: '기타',
          sortOrder: 5,
          bookmarkCount: 0,
        },
      ],
      uncategorizedCount: 1,
    };

    beforeEach(() => {
      server.use(
        http.get(url(API_ENDPOINTS.bookmark.folders), () =>
          HttpResponse.json(
            { status: 200, message: 'ok', data: manyFoldersResponse, timestamp: '' },
            { status: 200 }
          )
        )
      );
    });

    it('임계값을 넘으면 상단에 최근 저장한 폴더 구획이 뜨고, 아래 본 목록에서도 그대로 중복 표시된다', async () => {
      renderDialog();

      await waitFor(() => expect(screen.getByText('최근 저장한 폴더')).toBeInTheDocument());

      // 상단 구획 + 아래 본 목록 두 곳 모두에 렌더된다 (원칙1: 중복 표시, 빼지 않음)
      expect(screen.getAllByText('최근폴더')).toHaveLength(2);
      // 본 목록에도 "내 폴더" 헤더가 함께 뜬다
      expect(screen.getByText('내 폴더')).toBeInTheDocument();
    });

    it('상단 구획의 폴더를 탭해도 본 목록과 동일하게 추가 요청을 보낸다', async () => {
      const user = userEvent.setup();
      let called = false;
      server.use(
        http.post(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, RECENT_A)), () => {
          called = true;
          return HttpResponse.json(
            {
              status: 200,
              message: 'ok',
              data: bookmarkFoldersResponse([FOLDER_A, RECENT_A]),
              timestamp: '',
            },
            { status: 200 }
          );
        })
      );
      renderDialog();

      await waitFor(() => expect(screen.getAllByText('최근폴더')).toHaveLength(2));
      // 상단 구획 쪽(첫 번째 매치)을 클릭
      await user.click(screen.getAllByText('최근폴더')[0]!);

      await waitFor(() => expect(called).toBe(true));
    });
  });
});
