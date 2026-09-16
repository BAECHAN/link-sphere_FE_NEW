import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '@/test/utils';
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
