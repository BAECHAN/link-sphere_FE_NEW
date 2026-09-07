import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { useLocation } from 'react-router-dom';
import { TEXTS } from '@/shared/config/texts';
import { NavbarSearch } from '@/widgets/layout/navbar/ui/NavbarSearch';

// MemoryRouter 내부 URL은 화면에 안 보이므로, 제출 후 URL의 q가 어떻게 됐는지
// 검증하기 위한 테스트 전용 프로브. PostListSearch.test.tsx의 패턴을 따른다.
function LocationSearchProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderNavbarSearch(initialEntry: string) {
  return renderWithProviders(
    <>
      <NavbarSearch />
      <LocationSearchProbe />
    </>,
    { wrapperOptions: { initialEntries: [initialEntry] } }
  );
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
