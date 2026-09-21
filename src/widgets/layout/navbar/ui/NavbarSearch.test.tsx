import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { useLocation } from 'react-router-dom';
import { TEXTS } from '@/shared/config/texts';
import { NavbarSearch } from '@/widgets/layout/navbar/ui/NavbarSearch';

// MemoryRouter 내부 URL은 화면에 안 보이므로, 제출 후 URL의 pathname·search가 어떻게
// 됐는지 검증하기 위한 테스트 전용 프로브. PostListSearch.test.tsx의 패턴을 따른다.
function LocationProbe() {
  const location = useLocation();
  return (
    <>
      <div data-testid="location-pathname">{location.pathname}</div>
      <div data-testid="location-search">{location.search}</div>
    </>
  );
}

function renderNavbarSearch(
  initialEntry: string,
  props: Partial<{
    recentSearches: string[];
    onAddRecentSearch: (query: string) => void;
    onRemoveRecentSearch: (query: string) => void;
    onClearRecentSearches: () => void;
  }> = {}
) {
  const onAddRecentSearch = props.onAddRecentSearch ?? vi.fn();
  const onRemoveRecentSearch = props.onRemoveRecentSearch ?? vi.fn();
  const onClearRecentSearches = props.onClearRecentSearches ?? vi.fn();
  const recentSearches = props.recentSearches ?? [];

  const utils = renderWithProviders(
    <>
      <NavbarSearch
        recentSearches={recentSearches}
        onAddRecentSearch={onAddRecentSearch}
        onRemoveRecentSearch={onRemoveRecentSearch}
        onClearRecentSearches={onClearRecentSearches}
      />
      <LocationProbe />
    </>,
    { wrapperOptions: { initialEntries: [initialEntry] } }
  );

  return { ...utils, onAddRecentSearch, onRemoveRecentSearch, onClearRecentSearches };
}

describe('NavbarSearch — 검색어 유지', () => {
  it('/post?q=...로 진입하면 input에 검색어가 표시된다', () => {
    renderNavbarSearch('/post?q=리액트');

    expect(screen.getByPlaceholderText(TEXTS.placeholders.postSearch)).toHaveValue('리액트');
  });

  it('/bookmark?q=...처럼 다른 페이지의 q는 헤더 검색창에 표시되지 않는다', () => {
    renderNavbarSearch('/bookmark?q=폴더검색어');

    expect(screen.getByPlaceholderText(TEXTS.placeholders.postSearch)).toHaveValue('');
  });

  it('검색어를 입력해 제출해도 input이 비워지지 않고 유지된다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.type(input, '리액트');
    await user.keyboard('{Enter}');

    expect(input).toHaveValue('리액트');
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      '?q=%EB%A6%AC%EC%95%A1%ED%8A%B8'
    );
  });

  it('앞뒤 공백은 제출 시 trim되어 URL에 반영된다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.type(input, '  리액트  ');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('location-search')).toHaveTextContent(
      '?q=%EB%A6%AC%EC%95%A1%ED%8A%B8'
    );
  });

  it('검색어가 없을 때는 X 대신 단축키 안내(Kbd)가 보인다', () => {
    renderNavbarSearch('/post');

    expect(screen.queryByLabelText(TEXTS.ariaLabels.inputClear)).not.toBeInTheDocument();
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('X를 누르면 input만 비워지고 URL의 q는 그대로 남는다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(screen.getByLabelText(TEXTS.ariaLabels.inputClear));

    expect(input).toHaveValue('');
    expect(screen.getByTestId('location-search')).toHaveTextContent('q=');
  });
});

describe('NavbarSearch — filter 파라미터 보존', () => {
  it('/post?filter=bookmarked에서 제출하면 filter와 q가 둘 다 남는다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post?filter=bookmarked');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.type(input, '리액트');
    await user.keyboard('{Enter}');

    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).toContain('filter=bookmarked');
    expect(search).toContain('q=');
  });

  it('/post?q=A&filter=bookmarked에서 빈 값으로 제출하면 q만 사라지고 filter는 남는다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post?q=A&filter=bookmarked');

    // X 버튼 클릭은 포커스를 입력창 밖으로 옮겨(기존 동작, 결정 8) 이어지는 Enter가
    // form을 못 거친다 - user.clear()로 포커스를 유지한 채 값만 비운다.
    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.clear(input);
    await user.keyboard('{Enter}');

    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).toContain('filter=bookmarked');
    expect(search).not.toContain('q=');
  });

  it('/bookmark?folder=3에서 제출하면 /post?q=...로만 이동한다(folder 미유출)', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/bookmark?folder=3');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.type(input, '리액트');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId('location-pathname')).toHaveTextContent('/post');
    const search = screen.getByTestId('location-search').textContent ?? '';
    expect(search).not.toContain('folder');
  });
});

describe('NavbarSearch — 최근검색 기록', () => {
  it('제출하면 onAddRecentSearch가 trim된 값으로 호출된다', async () => {
    const user = userEvent.setup();
    const { onAddRecentSearch } = renderNavbarSearch('/post');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.type(input, '  리액트  ');
    await user.keyboard('{Enter}');

    expect(onAddRecentSearch).toHaveBeenCalledWith('리액트');
  });

  it('빈 값 제출은 onAddRecentSearch를 부르지 않는다', async () => {
    const user = userEvent.setup();
    const { onAddRecentSearch } = renderNavbarSearch('/post');

    await user.keyboard('{Enter}');

    expect(onAddRecentSearch).not.toHaveBeenCalled();
  });
});

describe('NavbarSearch — 최근검색 드롭다운', () => {
  it('최근검색이 있으면 포커스 시 목록이 보인다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post', { recentSearches: ['리액트', '타입스크립트'] });

    await user.click(screen.getByPlaceholderText(TEXTS.placeholders.postSearch));

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(screen.getByText('리액트')).toBeInTheDocument();
  });

  it('최근검색 0개면 포커스해도 아무것도 안 뜬다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post', { recentSearches: [] });

    await user.click(screen.getByPlaceholderText(TEXTS.placeholders.postSearch));

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('입력을 시작하면 닫히고, 다 지우면 다시 열린다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post', { recentSearches: ['리액트'] });

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(input);
    expect(screen.getByRole('grid')).toBeInTheDocument();

    await user.type(input, '타');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    await user.clear(input);
    expect(screen.getByRole('grid')).toBeInTheDocument();
  });

  it('ESC 1단계 — 열려 있을 때 ESC는 닫기만 하고 입력값을 보존한다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post?q=리액트', { recentSearches: ['리액트'] });

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(input);
    expect(screen.getByRole('grid')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(input).toHaveValue('리액트');
  });

  it('ESC 2단계 — 닫힌 상태에서 ESC는 입력만 비우고 드롭다운이 다시 열리지 않는다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post?q=리액트', { recentSearches: ['리액트'] });

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(input);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(input).toHaveValue('');
    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent('q=리액트');
  });

  it('행을 클릭하면 즉시 검색되고 드롭다운이 닫힌다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post', { recentSearches: ['리액트', '타입스크립트'] });

    await user.click(screen.getByPlaceholderText(TEXTS.placeholders.postSearch));
    await user.click(screen.getByText('타입스크립트'));

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
    expect(screen.getByTestId('location-search')).toHaveTextContent(
      encodeURIComponent('타입스크립트')
    );
  });

  it('바깥을 클릭하면 닫힌다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post', { recentSearches: ['리액트'] });

    await user.click(screen.getByPlaceholderText(TEXTS.placeholders.postSearch));
    expect(screen.getByRole('grid')).toBeInTheDocument();

    await user.click(document.body);

    expect(screen.queryByRole('grid')).not.toBeInTheDocument();
  });

  it('행의 X를 누르면 그 항목만 사라지고 드롭다운은 유지된다', async () => {
    const user = userEvent.setup();
    const { onRemoveRecentSearch } = renderNavbarSearch('/post', {
      recentSearches: ['리액트', '타입스크립트'],
    });

    await user.click(screen.getByPlaceholderText(TEXTS.placeholders.postSearch));
    // 검색어마다 삭제 버튼의 aria-label이 동일("검색어 삭제")하므로, DOM 순서상
    // 첫 번째("리액트")를 고른다.
    await user.click(screen.getAllByLabelText(TEXTS.recentSearch.removeItem)[0]!);

    expect(onRemoveRecentSearch).toHaveBeenCalledWith('리액트');
  });

  it('↓로 첫 행을 활성화하고 Enter로 검색한다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post', { recentSearches: ['리액트', '타입스크립트'] });

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(input);
    await user.keyboard('{ArrowDown}');

    expect(input).toHaveAttribute('aria-activedescendant', 'navbar-recent-search-cell-0-0');

    await user.keyboard('{Enter}');

    expect(screen.getByTestId('location-search')).toHaveTextContent(encodeURIComponent('리액트'));
  });

  it('↓를 검색어 개수만큼 누르면 "모두 지우기" 행에 도달하고, Enter로 전체 삭제된다', async () => {
    const user = userEvent.setup();
    const { onClearRecentSearches } = renderNavbarSearch('/post', {
      recentSearches: ['리액트', '타입스크립트'],
    });

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');

    expect(input).toHaveAttribute('aria-activedescendant', 'navbar-recent-search-cell-2-0');

    await user.keyboard('{Enter}');

    expect(onClearRecentSearches).toHaveBeenCalledTimes(1);
  });

  it('첫 행에서 ↑를 누르면 "모두 지우기" 행으로 이동한다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post', { recentSearches: ['리액트', '타입스크립트'] });

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(input);
    await user.keyboard('{ArrowDown}{ArrowUp}');

    expect(input).toHaveAttribute('aria-activedescendant', 'navbar-recent-search-cell-2-0');
  });

  it('IME 조합 중 Escape는 무시된다', async () => {
    const user = userEvent.setup();
    renderNavbarSearch('/post?q=리액트', { recentSearches: ['리액트'] });

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(input);

    fireEvent.keyDown(input, { key: 'Escape', isComposing: true });

    expect(screen.getByRole('grid')).toBeInTheDocument();
    expect(input).toHaveValue('리액트');
  });
});
