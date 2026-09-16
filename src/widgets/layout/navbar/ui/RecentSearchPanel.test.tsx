import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RecentSearchPanel } from '@/widgets/layout/navbar/ui/RecentSearchPanel';

// 이 패널은 Navbar.tsx가 isMobileSearchOpen && <RecentSearchPanel .../>로 조건부
// 마운트한다(자체 enabled prop 없음) - mount 자체가 열림 상태라, 마운트하면 배경
// 스크롤이 잠기고 언마운트하면 풀리는지만 검증하면 된다.
describe('RecentSearchPanel — 배경 스크롤 잠금', () => {
  it('마운트되면 배경 스크롤이 잠기고, 언마운트하면 풀린다', () => {
    const { unmount } = render(
      <RecentSearchPanel
        recentSearches={[]}
        onSelect={() => {}}
        onRemove={() => {}}
        onClearAll={() => {}}
      />
    );

    expect(document.body.hasAttribute('data-scroll-locked')).toBe(true);

    unmount();

    expect(document.body.hasAttribute('data-scroll-locked')).toBe(false);
  });
});
