import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { renderWithProviders, userEvent } from '@/test/utils';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { TEXTS } from '@/shared/config/texts';
import { BookmarkFolderPicker } from '@/features/post/create/ui/BookmarkFolderPicker';
import type { CreatePost } from '@/entities/post/model/post.schema';
import type { FolderListResponse } from '@/entities/folder/model/folder.schema';

// BookmarkFolderPicker는 공통 프레젠테이션(entities/folder/ui/FolderPickerDialog)에 얇게
// 위임하므로, 아래 케이스들은 FolderPickerDialog의 행 렌더링·최근 구획도 함께 검증한다.

// 데스크탑 모달 스타일로 고정 — matchMedia 스텁만으로는 useIsMobile 값이 effect 이후에나 정해져 불안정하다
vi.mock('@/shared/hooks/useIsMobile', () => ({ useIsMobile: () => false }));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

const FOLDER_A = 'folder-uuid-a';
const FOLDER_B = 'folder-uuid-b';
const now = new Date('2025-01-01');

const folderListResponse = {
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

const DEFAULT_VALUES: CreatePost = {
  url: '',
  title: '',
  categoryIds: [],
  isPrivate: false,
  bookmark: false,
  folderIds: [],
};

// BookmarkFolderPicker 는 자체 useForm 없이 useFormContext 로만 동작하므로,
// 등록 폼(useCreatePost)을 흉내 낸 최소 harness로 감싸고 현재 폼 값을 화면에 노출해 검증한다.
function Harness() {
  const form = useForm<CreatePost>({ defaultValues: DEFAULT_VALUES });
  const bookmark = form.watch('bookmark');
  const folderIds = form.watch('folderIds');

  return (
    <FormProvider {...form}>
      <div data-testid="bookmark-value">{String(bookmark)}</div>
      <div data-testid="folderIds-value">{folderIds.join(',')}</div>
      <BookmarkFolderPicker />
    </FormProvider>
  );
}

function renderPicker() {
  return renderWithProviders(<Harness />, { wrapperOptions: { queryClient } });
}

// 트리거 버튼도 선택된 폴더/미분류와 같은 텍스트를 표시하므로, 다이얼로그 안의 행만 좁혀서 조회한다.
function dialog() {
  return within(screen.getByRole('dialog'));
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

describe('BookmarkFolderPicker', () => {
  it('아무것도 선택하지 않으면 트리거에 "북마크 안 함"이 보인다', () => {
    renderPicker();

    expect(screen.getByRole('button', { name: '북마크 안 함' })).toBeInTheDocument();
    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('false');
    expect(screen.getByTestId('folderIds-value')).toHaveTextContent('');
  });

  it('폴더를 탭하면 선택되고 폼 값이 즉시 반영된다 (제출 전 지연 선택)', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));
    await waitFor(() => expect(dialog().getByText('개발')).toBeInTheDocument());
    await user.click(dialog().getByText('개발'));

    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('true');
    expect(screen.getByTestId('folderIds-value')).toHaveTextContent(FOLDER_A);
  });

  it('선택된 마지막 폴더를 다시 탭하면 미분류로 남는다 (북마크는 유지)', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));
    await waitFor(() => expect(dialog().getByText('개발')).toBeInTheDocument());
    await user.click(dialog().getByText('개발'));
    expect(screen.getByTestId('folderIds-value')).toHaveTextContent(FOLDER_A);

    await user.click(dialog().getByText('개발'));

    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('true');
    expect(screen.getByTestId('folderIds-value')).toHaveTextContent('');
  });

  it('미분류 행을 탭하면 북마크가 켜지고 폴더는 비어 있다', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));
    await waitFor(() => expect(dialog().getByText('미분류')).toBeInTheDocument());
    await user.click(dialog().getByText('미분류'));

    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('true');
    expect(screen.getByTestId('folderIds-value')).toHaveTextContent('');
  });

  it('체크된 미분류를 다시 탭해도 해제되지 않는다 (no-op)', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));
    await waitFor(() => expect(dialog().getByText('미분류')).toBeInTheDocument());
    await user.click(dialog().getByText('미분류'));
    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('true');

    await user.click(dialog().getByText('미분류'));

    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('true');
    expect(screen.getByTestId('folderIds-value')).toHaveTextContent('');
  });

  it('"북마크 안 함" 행을 누르면 선택이 전부 해제되고 모달이 닫힌다', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));
    await waitFor(() => expect(dialog().getByText('개발')).toBeInTheDocument());
    await user.click(dialog().getByText('개발'));
    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('true');

    await user.click(dialog().getByText('북마크 안 함'));

    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('false');
    expect(screen.getByTestId('folderIds-value')).toHaveTextContent('');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('"북마크 안 함" 행은 아무것도 선택하지 않은 상태에서도 항상 보인다', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));

    await waitFor(() => expect(dialog().getByText('개발')).toBeInTheDocument());
    expect(dialog().getByText('북마크 안 함')).toBeInTheDocument();
  });

  it('확인 버튼을 누르면 모달이 닫힌다', async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await user.click(dialog().getByRole('button', { name: TEXTS.buttons.confirm }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('새 폴더를 만들면 그 폴더가 선택된 상태로 폼에 반영된다', async () => {
    const user = userEvent.setup();
    const NEW_FOLDER_ID = 'folder-uuid-new';
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () =>
        HttpResponse.json(
          {
            status: 201,
            message: 'ok',
            data: {
              id: NEW_FOLDER_ID,
              name: '읽을거리',
              sortOrder: 2,
              bookmarkCount: 0,
              createdAt: now,
              updatedAt: now,
            },
            timestamp: '',
          },
          { status: 201 }
        )
      )
    );
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));
    await waitFor(() => expect(screen.getByText('새 폴더 만들기')).toBeInTheDocument());
    await user.click(screen.getByText('새 폴더 만들기'));
    await user.type(screen.getByPlaceholderText('새 폴더 이름'), '읽을거리');
    await user.click(screen.getByRole('button', { name: '생성' }));

    await waitFor(() =>
      expect(screen.getByTestId('folderIds-value')).toHaveTextContent(NEW_FOLDER_ID)
    );
    expect(screen.getByTestId('bookmark-value')).toHaveTextContent('true');
  });

  it('임계값을 넘으면 등록 폼에서도 최근 저장한 폴더 구획이 뜬다', async () => {
    // 임계값: 폴더 6개 이상 + lastUsedAt 있는 폴더 3개 이상이어야 노출된다
    // (FolderSelector.test.tsx의 manyFoldersResponse와 동일한 픽스처)
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
    server.use(
      http.get(url(API_ENDPOINTS.bookmark.folders), () =>
        HttpResponse.json(
          { status: 200, message: 'ok', data: manyFoldersResponse, timestamp: '' },
          { status: 200 }
        )
      )
    );
    const user = userEvent.setup();
    renderPicker();

    await user.click(screen.getByRole('button', { name: '북마크 안 함' }));

    await waitFor(() => expect(dialog().getByText('최근 저장한 폴더')).toBeInTheDocument());
    expect(dialog().getAllByText('최근폴더')).toHaveLength(2);
  });
});
