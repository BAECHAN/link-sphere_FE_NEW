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

  it('폴더가 1개 이상이면 "내 폴더" 구획 헤더가 뜬다 (최근 구획 임계값 미달이어도)', async () => {
    renderSelector();

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
    renderSelector();

    await waitFor(() => expect(screen.getByText('북마크 제거')).toBeInTheDocument());
    await user.click(screen.getByText('북마크 제거'));

    await waitFor(() => expect(toggleCalled).toBe(true));
  });

  describe('최근 저장한 폴더 (split menu 상단 구획)', () => {
    // 임계값: 폴더 6개 이상 + lastUsedAt 있는 폴더 3개 이상이어야 노출된다
    const RECENT_A = 'folder-uuid-recent-a';
    const manyFoldersResponse: FolderListResponse = {
      folders: [
        {
          id: FOLDER_A,
          name: '개발',
          sortOrder: 0,
          bookmarkCount: 2,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: FOLDER_B,
          name: '나중에 읽기',
          sortOrder: 1,
          bookmarkCount: 4,
          createdAt: now,
          updatedAt: now,
        },
        {
          id: RECENT_A,
          name: '최근폴더',
          sortOrder: 2,
          bookmarkCount: 1,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: new Date('2025-01-05'),
        },
        {
          id: 'folder-uuid-c',
          name: '디자인',
          sortOrder: 3,
          bookmarkCount: 0,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: new Date('2025-01-04'),
        },
        {
          id: 'folder-uuid-d',
          name: '읽을거리',
          sortOrder: 4,
          bookmarkCount: 0,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: new Date('2025-01-03'),
        },
        {
          id: 'folder-uuid-e',
          name: '기타',
          sortOrder: 5,
          bookmarkCount: 0,
          createdAt: now,
          updatedAt: now,
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
      renderSelector();

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
      renderSelector();

      await waitFor(() => expect(screen.getAllByText('최근폴더')).toHaveLength(2));
      // 상단 구획 쪽(첫 번째 매치)을 클릭
      await user.click(screen.getAllByText('최근폴더')[0]!);

      await waitFor(() => expect(called).toBe(true));
    });
  });
});
