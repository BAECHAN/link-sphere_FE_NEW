import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { BookmarkSearch } from '@/widgets/bookmark/bookmark-search/ui/BookmarkSearch';

function renderBookmarkSearch(initialEntry: string) {
  return renderWithProviders(<BookmarkSearch />, {
    wrapperOptions: { initialEntries: [initialEntry] },
  });
}

describe('BookmarkSearch — X 버튼', () => {
  it('X를 누르면 포커스가 input으로 돌아온다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    // input.tsx의 X는 sr-only "Clear" 텍스트만 갖고 aria-label이 없다 — role로 찾는다.
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(input).toHaveFocus();
  });

  it('X를 누르면 input이 비워지고 URL의 q도 삭제된다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.click(screen.getByRole('button', { name: 'Clear' }));

    expect(input).toHaveValue('');
  });
});
