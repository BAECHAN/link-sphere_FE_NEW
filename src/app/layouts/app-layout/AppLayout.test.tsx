import { act, fireEvent, screen } from '@testing-library/react';
import { AppLayout } from '@/app/layouts/app-layout/AppLayout';
import { renderWithProviders } from '@/test/utils';

// 맨 위로 버튼 노출만 본다 - 내비게이션 위젯은 인증·쿼리 준비가 많아 비운다
vi.mock('@/widgets/layout/navbar/ui/Navbar', () => ({ Navbar: () => null }));
vi.mock('@/widgets/layout/sidebar/ui/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('@/widgets/layout/bottom-tab-bar/ui/BottomTabBar', () => ({ BottomTabBar: () => null }));

function renderAt(path: string) {
  renderWithProviders(<AppLayout>content</AppLayout>, {
    wrapperOptions: { initialEntries: [path] },
  });

  // ScrollToTop은 300px 넘게 내려야 나타난다
  act(() => {
    window.scrollY = 301;
    fireEvent.scroll(window);
  });
}

describe('AppLayout 맨 위로 버튼', () => {
  beforeEach(() => {
    window.scrollY = 0;
  });

  it.each(['/post', '/bookmark', '/my/comments', '/my/account'])('%s에서는 보인다', (path) => {
    renderAt(path);

    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();
  });

  // /post/submit은 '/post/:id' 패턴에도 맞는다 - 상세로 착각해 우연히 숨던 것을 명시 조건으로 바꿨다
  it.each(['/post/abc', '/post/submit', '/post/edit/abc'])('%s에서는 숨긴다', (path) => {
    renderAt(path);

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).not.toBeInTheDocument();
  });
});
