import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { NotFoundPage } from '@/pages/404/NotFoundPage';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

describe('NotFoundPage 홈 버튼', () => {
  it('홈으로 가는 링크로 렌더한다', () => {
    renderWithProviders(<NotFoundPage />);

    expect(screen.getByRole('link', { name: TEXTS.buttons.home })).toHaveAttribute(
      'href',
      ROUTES_PATHS.HOME
    );
    expect(screen.queryByRole('button', { name: TEXTS.buttons.home })).toBeNull();
  });
});
