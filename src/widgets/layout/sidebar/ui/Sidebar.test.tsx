import { beforeEach, describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { useSidebarStore } from '@/shared/store/sidebar.store';
import { Sidebar } from '@/widgets/layout/sidebar/ui/Sidebar';

// 모바일 드로어 백드롭이 RemoveScroll(react-remove-scroll)로 배경 스크롤을 잠그는지
// 검증한다 - jsdom에서 data-scroll-locked 속성으로 확인 가능함을 실측했다.
describe('Sidebar — 모바일 드로어 배경 스크롤 잠금', () => {
  it('드로어가 닫혀 있으면 배경 스크롤이 잠기지 않는다', () => {
    renderWithProviders(<Sidebar />, { wrapperOptions: { initialEntries: ['/post'] } });

    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });

  it('드로어가 열리면 배경 스크롤이 잠긴다', () => {
    renderWithProviders(<Sidebar />, {
      wrapperOptions: { initialEntries: [{ pathname: '/post', state: { sidebarOpen: true } }] },
    });

    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);
  });

  it('드로어를 언마운트하면 배경 스크롤 잠금이 풀린다', () => {
    const { unmount } = renderWithProviders(<Sidebar />, {
      wrapperOptions: { initialEntries: [{ pathname: '/post', state: { sidebarOpen: true } }] },
    });

    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);

    unmount();

    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });
});

describe('Sidebar — 데스크톱 햄버거 더블클릭', () => {
  beforeEach(() => {
    useSidebarStore.setState({ isOpen: false });
  });

  // 데스크톱 사이드바(첫 번째 aside)의 햄버거 버튼. 모바일 드로어 aside에도 같은 이름의
  // 버튼이 있어 범위를 좁힌다.
  function getDesktopToggle() {
    const desktopAside = screen.getAllByRole('complementary', { hidden: true })[0]!;
    return within(desktopAside).getByRole('button', { name: TEXTS.nav.toggleMenu, hidden: true });
  }

  it('즉시 다시 누르면 무의식적 더블클릭으로 보고 무시한다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar />, { wrapperOptions: { initialEntries: ['/post'] } });
    const toggle = getDesktopToggle();

    await user.click(toggle);
    // useClickGuard(400ms, useClickGuard.ts) - 그보다 짧은 재클릭은 무시한다
    await user.click(toggle);

    expect(useSidebarStore.getState().isOpen).toBe(true);
  });

  it('충분한 시간(400ms) 뒤 다시 누르면 접힌다', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Sidebar />, { wrapperOptions: { initialEntries: ['/post'] } });
    const toggle = getDesktopToggle();

    await user.click(toggle);
    await new Promise((resolve) => setTimeout(resolve, 450));
    await user.click(toggle);

    expect(useSidebarStore.getState().isOpen).toBe(false);
  });
});
