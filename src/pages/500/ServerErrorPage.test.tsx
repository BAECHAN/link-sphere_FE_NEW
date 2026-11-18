import { describe, expect, it } from 'vitest';
import { renderWithProviders, screen } from '@/test/utils';
import { ServerErrorPage } from '@/pages/500/ServerErrorPage';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

describe('ServerErrorPage 홈 버튼', () => {
  it('홈으로 가는 링크로 렌더한다', () => {
    renderWithProviders(<ServerErrorPage />);

    expect(screen.getByRole('link', { name: TEXTS.buttons.home })).toHaveAttribute(
      'href',
      ROUTES_PATHS.HOME
    );
    expect(screen.queryByRole('button', { name: TEXTS.buttons.home })).toBeNull();
  });
});
