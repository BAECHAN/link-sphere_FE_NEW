import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToggleButton } from '@/shared/ui/elements/ToggleButton';

// ToggleButton이 useClickGuard(400ms, useClickGuard.ts)로 짧은 재클릭을 무시하는지 검증한다.
describe('ToggleButton', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('즉시 다시 누르면 무의식적 더블클릭으로 보고 무시한다', async () => {
    // 가드가 재는 실제 시계를 멈춰 두 클릭 사이를 0ms로 고정한다(Navbar.test.tsx의 같은 테스트와 같은 이유)
    vi.useFakeTimers({ toFake: ['Date'] });
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<ToggleButton onClick={handleClick}>토글</ToggleButton>);

    await user.dblClick(screen.getByRole('button', { name: '토글' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('충분한 시간(400ms) 뒤 다시 누르면 다시 호출한다', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();
    render(<ToggleButton onClick={handleClick}>토글</ToggleButton>);
    const button = screen.getByRole('button', { name: '토글' });

    await user.click(button);
    await new Promise((resolve) => setTimeout(resolve, 450));
    await user.click(button);

    expect(handleClick).toHaveBeenCalledTimes(2);
  });
});
