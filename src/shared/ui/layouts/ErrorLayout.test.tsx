import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { TEXTS } from '@/shared/config/texts';

describe('ErrorLayout 홈 버튼', () => {
  it('homeTo가 있으면 홈 버튼을 그 경로로 가는 링크로 렌더한다', () => {
    renderWithProviders(<ErrorLayout title="404" homeTo="/" />);

    expect(screen.getByRole('link', { name: TEXTS.buttons.home })).toHaveAttribute('href', '/');
    expect(screen.queryByRole('button', { name: TEXTS.buttons.home })).toBeNull();
  });

  it('라우터 밖에서는 onHomeClick으로 버튼을 렌더한다', async () => {
    const onHomeClick = vi.fn();
    const user = userEvent.setup();
    // AppErrorFallback처럼 라우터 없이 렌더해도 깨지지 않아야 한다
    render(<ErrorLayout title="500" onHomeClick={onHomeClick} />);

    await user.click(screen.getByRole('button', { name: TEXTS.buttons.home }));

    expect(onHomeClick).toHaveBeenCalledOnce();
  });

  it('둘 다 없으면 홈 버튼을 렌더하지 않는다', () => {
    render(<ErrorLayout title="오류" />);

    expect(screen.queryByText(TEXTS.buttons.home)).toBeNull();
  });
});
