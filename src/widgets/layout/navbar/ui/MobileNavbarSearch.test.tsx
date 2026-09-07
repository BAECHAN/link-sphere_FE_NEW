import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, userEvent } from '@/test/utils';
import { useLocation } from 'react-router-dom';
import { TEXTS } from '@/shared/config/texts';
import { MobileNavbarSearch } from '@/widgets/layout/navbar/ui/MobileNavbarSearch';

// MemoryRouter 내부 URL은 화면에 안 보이므로, X 클릭 후 URL의 q가 그대로인지
// 검증하기 위한 테스트 전용 프로브.
function LocationSearchProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderMobileSearch(
  initialEntry: string,
  props: { onClose?: () => void; onSubmit?: (query: string) => void } = {}
) {
  const onClose = props.onClose ?? vi.fn();
  const onSubmit = props.onSubmit ?? vi.fn();
  const utils = renderWithProviders(
    <>
      <MobileNavbarSearch onClose={onClose} onSubmit={onSubmit} />
      <LocationSearchProbe />
    </>,
    { wrapperOptions: { initialEntries: [initialEntry] } }
  );
  return { ...utils, onClose, onSubmit };
}

describe('MobileNavbarSearch — 검색어 유지', () => {
  it('/post?q=...로 진입하면 input에 검색어가 미리 채워진다', () => {
    renderMobileSearch('/post?q=리액트');

    expect(screen.getByPlaceholderText(TEXTS.placeholders.postSearch)).toHaveValue('리액트');
  });

  it('X를 누르면 input만 비워지고 패널은 닫히지 않으며 URL의 q도 유지된다', async () => {
    const user = userEvent.setup();
    const { onClose } = renderMobileSearch('/post?q=리액트');

    const input = screen.getByPlaceholderText(TEXTS.placeholders.postSearch);
    await user.click(screen.getByLabelText(TEXTS.ariaLabels.inputClear));

    expect(input).toHaveValue('');
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId('location-search')).toHaveTextContent('q=');
  });

  it('input이 비어있을 때 트레일링 아이콘을 누르면 onClose가 호출된다', async () => {
    const user = userEvent.setup();
    const { onClose } = renderMobileSearch('/post');

    // input이 비면 뒤로가기 버튼과 트레일링 아이콘의 aria-label이 둘 다 "닫기"로 같아진다
    // (MobileNavbarSearch.tsx: searchInput ? inputClear : close). DOM 순서상 트레일링
    // 아이콘이 뒤로가기 버튼 다음에 렌더되므로 두 번째 요소를 클릭한다.
    const closeButtons = screen.getAllByLabelText(TEXTS.ariaLabels.close);
    expect(closeButtons).toHaveLength(2);
    await user.click(closeButtons[1]!);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('제출하면 onSubmit이 입력값으로 호출된다', async () => {
    const user = userEvent.setup();
    const { onSubmit } = renderMobileSearch('/post');

    await user.type(screen.getByPlaceholderText(TEXTS.placeholders.postSearch), '리액트');
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledWith('리액트');
  });
});
