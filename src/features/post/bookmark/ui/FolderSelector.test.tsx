import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { FolderSelector } from '@/features/post/bookmark/ui/FolderSelector';
import type {
  BookmarkFoldersResponse,
  FolderListResponse,
} from '@/entities/folder/model/folder.schema';

// 데스크탑 모달 스타일로 고정 — matchMedia 스텁만으로는 useIsMobile 값이 effect 이후에나 정해져 불안정하다
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const POST_ID = 'post-uuid-1';
const FOLDER_A = 'folder-uuid-a';
const FOLDER_B = 'folder-uuid-b';
const now = new Date('2025-01-01');

const folderListResponse: FolderListResponse = {
  folders: [
    { id: FOLDER_A, name: '개발', sortOrder: 0, bookmarkCount: 2, createdAt: now, updatedAt: now },
    {
      id: FOLDER_B,
      name: '나중에 읽기',
      sortOrder: 1,
      bookmarkCount: 4,
      createdAt: now,
      updatedAt: now,
    },
  ],
  uncategorizedCount: 1,
};

function renderSelector(props: Partial<React.ComponentProps<typeof FolderSelector>> = {}) {
  const onOpenChange = vi.fn();
  const result = renderWithProviders(
    <FolderSelector
      postId={POST_ID}
      isBookmarked
      bookmarkFolderIds={[FOLDER_A]}
      open
      onOpenChange={onOpenChange}
      {...props}
    />,
    { wrapperOptions: { queryClient } }
  );
  return { ...result, onOpenChange };
}

beforeEach(() => {
  queryClient.clear();
  vi.clearAllMocks();
  server.use(
    http.get(url(API_ENDPOINTS.bookmark.folders), () =>
      HttpResponse.json(
        { status: 200, message: 'ok', data: folderListResponse, timestamp: '' },
        { status: 200 }
      )
    )
  );
});

afterEach(() => {
  queryClient.clear();
});

function bookmarkFoldersResponse(folderIds: string[]): BookmarkFoldersResponse {
  return { postId: POST_ID, isBookmarked: true, folderIds };
}

describe('FolderSelector', () => {
  it('소속된 모든 폴더 행에 체크 표시가 뜬다', async () => {
    renderSelector({ bookmarkFolderIds: [FOLDER_A, FOLDER_B] });

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());

    const devRow = screen.getByText('개발').closest('button');
    const laterRow = screen.getByText('나중에 읽기').closest('button');
    expect(devRow?.querySelector('svg.lucide-check')).toBeTruthy();
    expect(laterRow?.querySelector('svg.lucide-check')).toBeTruthy();
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
    const { onOpenChange } = renderSelector();

    await waitFor(() => expect(screen.getByText('나중에 읽기')).toBeInTheDocument());
    await user.click(screen.getByText('나중에 읽기'));

    await waitFor(() => expect(called).toBe(true));
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('소속 폴더를 탭하면 제거 요청을 보낸다', async () => {
    const user = userEvent.setup();
    let called = false;
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_A)), () => {
        called = true;
        return HttpResponse.json(
          { status: 200, message: 'ok', data: bookmarkFoldersResponse([]), timestamp: '' },
          { status: 200 }
        );
      })
    );
    renderSelector();

    await waitFor(() => expect(screen.getByText('개발')).toBeInTheDocument());
    await user.click(screen.getByText('개발'));

    await waitFor(() => expect(called).toBe(true));
  });

  it('체크된 미분류를 탭하면 아무 요청도 보내지 않는다 (no-op)', async () => {
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
    renderSelector({ bookmarkFolderIds: [] });

    await waitFor(() => expect(screen.getByText('미분류')).toBeInTheDocument());
    await user.click(screen.getByText('미분류'));

    // no-op 이므로 잠깐 대기해도 요청이 발생하지 않아야 한다
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(clearCalled).toBe(false);
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
    renderSelector();

    await waitFor(() => expect(screen.getByText('북마크 제거')).toBeInTheDocument());
    await user.click(screen.getByText('북마크 제거'));

    await waitFor(() => expect(toggleCalled).toBe(true));
  });
});
