import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { ForbiddenPage } from '@/pages/403/ForbiddenPage';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

describe('ForbiddenPage 홈 버튼', () => {
  it('홈으로 가는 링크로 렌더한다', () => {
    renderWithProviders(<ForbiddenPage />);

    expect(screen.getByRole('link', { name: TEXTS.buttons.home })).toHaveAttribute(
      'href',
      ROUTES_PATHS.HOME
    );
    expect(screen.queryByRole('button', { name: TEXTS.buttons.home })).toBeNull();
  });
});
