import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CharacterCount } from '@/shared/ui/elements/CharacterCount';

describe('CharacterCount', () => {
  it('지금 / 상한 뒤에 단위를 붙이고, 천 단위마다 쉼표를 넣는다', () => {
    render(<CharacterCount current={1234} max={2000} suffix="자" />);

    expect(screen.getByText('1,234 / 2,000자')).toBeInTheDocument();
  });

  it('상한과 같으면 초과 색이 아니고, 하나라도 넘으면 초과 색이다', () => {
    const { rerender } = render(<CharacterCount current={15} max={15} />);

    expect(screen.getByText('15 / 15')).not.toHaveClass('text-destructive');

    rerender(<CharacterCount current={16} max={15} />);

    expect(screen.getByText('16 / 15')).toHaveClass('text-destructive');
  });

  it('입력칸의 aria-describedby로 이으면 그 입력칸의 설명으로 읽힌다', () => {
    render(
      <>
        <textarea aria-label="본문" aria-describedby="count" />
        <CharacterCount id="count" current={3} max={15} suffix="자" />
      </>
    );

    expect(screen.getByRole('textbox', { name: '본문' })).toHaveAccessibleDescription('3 / 15자');
  });
});
