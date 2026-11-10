import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, screen } from '@testing-library/react';
import { useLocation } from 'react-router-dom';
import { renderWithDataRouter, userEvent } from '@/test/utils';
import { useAuthStore } from '@/shared/store/auth.store';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { TEXTS } from '@/shared/config/texts';
import { BookmarkPostButton } from '@/features/bookmark/toggle/ui/BookmarkPostButton';
import { GlobalPostBookmarkFolderDialog } from '@/features/bookmark/toggle/ui/GlobalPostBookmarkFolderDialog';
import type { BookmarkFolderSelectRenderProps } from '@/features/bookmark/toggle/ui/PostCardBookmarkFolderDialog';
import {
  POST_BOOKMARK_FOLDER_DIALOG_KEY,
  usePostBookmarkFolderDialogStore,
  type PostBookmarkFolderDialogTarget,
} from '@/features/bookmark/toggle/hooks/postBookmarkFolderDialog.store';

// 창 마크업 대신 받은 값을 그대로 보이는 가짜 - 호스트가 어떤 글의 어떤 상태로 창을 그리는지만 본다
function renderFolderSelect(props: BookmarkFolderSelectRenderProps) {
  if (!props.open) {
    return null;
  }

  return (
    <div role="dialog">
      <span data-testid="bookmarked">{String(props.isBookmarked)}</span>
      <span data-testid="folders">{props.selectedFolderIds.join(',')}</span>
    </div>
  );
}

function LocationState() {
  const location = useLocation();

  return <span data-testid="location-state">{JSON.stringify(location.state)}</span>;
}

function Screen({ cards }: { cards: PostBookmarkFolderDialogTarget[] }) {
  return (
    <>
      {cards.map((card) => (
        <BookmarkPostButton key={card.postId} {...card} />
      ))}
      <GlobalPostBookmarkFolderDialog renderFolderSelect={renderFolderSelect} />
      <LocationState />
    </>
  );
}

const cardA: PostBookmarkFolderDialogTarget = {
  postId: 'post-a',
  isBookmarked: false,
  bookmarkFolderIds: [],
};
const cardB: PostBookmarkFolderDialogTarget = {
  postId: 'post-b',
  isBookmarked: true,
  bookmarkFolderIds: ['folder-1'],
};

async function openCard(index: number) {
  const buttons = screen.getAllByRole('button', {
    name: new RegExp(`${TEXTS.ariaLabels.bookmarkSave}|${TEXTS.ariaLabels.bookmarkChange}`),
  });

  await userEvent.click(buttons[index]!);
}

describe('GlobalPostBookmarkFolderDialog', () => {
  beforeEach(() => {
    useAuthStore.setState({ isAuthenticated: true });
  });

  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false });
    usePostBookmarkFolderDialogStore.setState({ target: null });
    useLoginDialogStore.setState({ pendingAction: undefined, onSuccess: undefined });
  });

  it('카드의 버튼을 누르면 호스트가 그 글의 상태로 창을 연다', async () => {
    renderWithDataRouter(<Screen cards={[cardA, cardB]} />);

    await openCard(1);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('bookmarked')).toHaveTextContent('true');
    expect(screen.getByTestId('folders')).toHaveTextContent('folder-1');
  });

  it('창이 열린 동안 그 카드의 북마크 상태가 바뀌면 창도 따라간다', async () => {
    const { rerender } = renderWithDataRouter(<Screen cards={[cardA, cardB]} />);

    await openCard(0);
    rerender(
      <Screen cards={[{ ...cardA, isBookmarked: true, bookmarkFolderIds: ['folder-2'] }, cardB]} />
    );

    expect(screen.getByTestId('bookmarked')).toHaveTextContent('true');
    expect(screen.getByTestId('folders')).toHaveTextContent('folder-2');
  });

  it('다른 카드의 상태가 바뀌어도 열린 창은 그대로다', async () => {
    const { rerender } = renderWithDataRouter(<Screen cards={[cardA, cardB]} />);

    await openCard(0);
    rerender(<Screen cards={[cardA, { ...cardB, bookmarkFolderIds: ['folder-9'] }]} />);

    expect(screen.getByTestId('bookmarked')).toHaveTextContent('false');
    expect(screen.getByTestId('folders')).toHaveTextContent('');
  });

  it('창을 연 카드가 목록에서 빠져도 창은 마지막 상태로 열려 있다', async () => {
    // 북마크 페이지에서 폴더를 빼면 낙관적 갱신이 카드를 바로 지운다 - 창은 요청 결과를 기다려야 한다
    const { rerender } = renderWithDataRouter(<Screen cards={[cardA, cardB]} />);

    await openCard(1);
    const dialog = screen.getByRole('dialog');
    rerender(<Screen cards={[cardA]} />);

    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(screen.getByTestId('folders')).toHaveTextContent('folder-1');
  });

  it('열린 엔트리인데 대상이 없으면(창을 연 채 새로고침) 엔트리를 닫는다', () => {
    renderWithDataRouter(<Screen cards={[cardA]} />, {
      wrapperOptions: {
        initialEntries: [
          '/',
          { pathname: '/', state: { [POST_BOOKMARK_FOLDER_DIALOG_KEY]: true } },
        ],
      },
    });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-state')).toHaveTextContent('null');
  });

  it('로그인 뒤 재개로 열면 로그인으로 바뀐 최신 상태로 연다', async () => {
    // 재개 액션은 클릭 시점 값을 담고 있다 - 로그인 뒤 다시 받은 북마크 상태를 카드가 넣어 줘야 한다
    useAuthStore.setState({ isAuthenticated: false });
    const { rerender } = renderWithDataRouter(<Screen cards={[cardA]} />);

    await openCard(0);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    useAuthStore.setState({ isAuthenticated: true });
    rerender(
      <Screen cards={[{ ...cardA, isBookmarked: true, bookmarkFolderIds: ['folder-3'] }]} />
    );
    act(() => {
      useLoginDialogStore.getState().pendingAction?.();
    });

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('bookmarked')).toHaveTextContent('true');
    expect(screen.getByTestId('folders')).toHaveTextContent('folder-3');
  });
});
