import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import { TEXTS } from '@/shared/config/texts';
import { BookmarkSearch } from '@/widgets/bookmark/bookmark-search/ui/BookmarkSearch';

// 뒤로가기(외부 URL 변경)를 재현하는 테스트 전용 버튼
function BackButton() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate(-1)}>
      test-back
    </button>
  );
}

// MemoryRouter 내부 URL은 화면에 안 보이므로 URL의 q를 확인하기 위한 테스트 전용 프로브
// (선례: PostListFilter.test.tsx의 LocationSearchProbe)
function LocationSearchProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function readSearchParams() {
  return new URLSearchParams(screen.getByTestId('location-search').textContent ?? '');
}

function renderBookmarkSearch(...initialEntries: string[]) {
  return renderWithProviders(
    <>
      <BookmarkSearch />
      <LocationSearchProbe />
      <BackButton />
    </>,
    {
      wrapperOptions: { initialEntries },
    }
  );
}

describe('BookmarkSearch — X 버튼', () => {
  it('X를 누르면 포커스가 input으로 돌아온다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    // input.tsx의 X는 sr-only 글자만 갖고 aria-label이 없다 — role로 찾는다.
    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.inputClear }));

    expect(input).toHaveFocus();
  });

  it('X를 누르면 input이 비워지고 URL의 q도 삭제된다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.inputClear }));

    expect(input).toHaveValue('');
  });
});

describe('BookmarkSearch — 입력을 다 지웠을 때', () => {
  it('검색 중에 입력을 다 지우면 엔터 없이 URL의 q가 사라진다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.clear(input);

    expect(input).toHaveValue('');
    expect(readSearchParams().has('q')).toBe(false);
  });

  it('한 글자씩 지워 빈 칸이 되는 순간에 URL의 q가 사라진다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=ab');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.click(input);
    await user.keyboard('{Backspace}');

    expect(readSearchParams().get('q')).toBe('ab');

    await user.keyboard('{Backspace}');

    expect(readSearchParams().has('q')).toBe(false);
  });

  it('다른 글자를 입력하는 동안에는 URL의 q가 바뀌지 않는다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.type(input, '쿼리');

    expect(input).toHaveValue('리액트쿼리');
    expect(readSearchParams().get('q')).toBe('리액트');
  });

  it('공백만 남은 입력은 URL의 q를 지우지 않는다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=a');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.click(input);
    await user.keyboard(' {ArrowLeft}{Backspace}');

    expect(input).toHaveValue(' ');
    expect(readSearchParams().get('q')).toBe('a');
  });

  it('다 지운 직후 바로 입력한 글자가 입력창에 남는다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.clear(input);
    await user.type(input, '뷰');

    expect(input).toHaveValue('뷰');
    expect(readSearchParams().has('q')).toBe(false);
  });

  it('입력을 다 지워도 folder와 sort는 남는다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?folder=all&sort=oldest&q=리액트');

    await user.clear(screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch));

    const params = readSearchParams();
    expect(params.has('q')).toBe(false);
    expect(params.get('folder')).toBe('all');
    expect(params.get('sort')).toBe('oldest');
  });
});

describe('BookmarkSearch — 모바일 키보드 힌트', () => {
  it('enterKeyHint가 search로 설정된다', () => {
    renderBookmarkSearch('/bookmark');

    expect(screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch)).toHaveAttribute(
      'enterkeyhint',
      'search'
    );
  });
});

describe('BookmarkSearch — URL 동기화', () => {
  it('뒤로가기로 URL의 q가 바뀌면 입력값도 따라간다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=이전', '/bookmark?q=지금');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    expect(input).toHaveValue('지금');

    await user.click(screen.getByRole('button', { name: 'test-back' }));

    expect(input).toHaveValue('이전');
  });

  it('입력을 다 지워 검색을 해제한 뒤에도 뒤로가기로 바뀐 q를 따라간다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=이전', '/bookmark?q=지금');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.clear(input);
    await user.type(input, '새');
    await user.click(screen.getByRole('button', { name: 'test-back' }));

    expect(input).toHaveValue('이전');
  });

  it('X로 검색을 해제하고 글자를 친 뒤에도 뒤로가기로 바뀐 q를 따라간다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=이전', '/bookmark?q=지금');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.inputClear }));
    await user.type(input, '새');
    await user.click(screen.getByRole('button', { name: 'test-back' }));

    expect(input).toHaveValue('이전');
  });

  it('q가 없을 때 X를 눌러도 뒤로가기로 바뀐 q를 따라간다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark?q=이전', '/bookmark');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.type(input, '임시');
    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.inputClear }));
    await user.click(screen.getByRole('button', { name: 'test-back' }));

    expect(input).toHaveValue('이전');
  });

  it('X로 해제한 뒤 다시 검색했다가 뒤로가기로 q가 없어지면 입력창도 비워진다', async () => {
    const user = userEvent.setup();
    renderBookmarkSearch('/bookmark', '/bookmark?q=지금');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.bookmarkSearch);
    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.inputClear }));
    await user.type(input, '새{Enter}');
    await user.type(input, '추가');

    expect(input).toHaveValue('새추가');

    await user.click(screen.getByRole('button', { name: 'test-back' }));

    expect(input).toHaveValue('');
  });
});
