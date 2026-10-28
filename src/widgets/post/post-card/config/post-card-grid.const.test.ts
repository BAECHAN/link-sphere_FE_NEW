import { describe, expect, it } from 'vitest';
import { POST_CARD_GRID } from '@/widgets/post/post-card/config/post-card-grid.const';

// Tailwind 기본 브레이크포인트(rem, tailwindcss/theme.css의 --breakpoint-*) - globals.css에 재정의 없음(grep으로 확인)
const BREAKPOINT_REM: Record<string, number> = {
  sm: 40,
  md: 48,
  lg: 64,
  xl: 80,
  '2xl': 96,
};

// Tailwind v4 기본 --spacing: 0.25rem = 4px (design-tokens skill 참고, globals.css 재정의 없음)
const SPACING_UNIT_PX = 4;

function byMinWidthDesc<T extends { minWidthRem: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => b.minWidthRem - a.minWidthRem);
}

function parseGap(className: string) {
  const gaps: { minWidthRem: number; gap: number }[] = [];
  for (const token of className.split(' ')) {
    const match = /^(?:([a-z0-9]+):)?gap-(\d+)$/.exec(token);
    if (!match) {
      continue;
    }
    const [, breakpoint, scale] = match;
    gaps.push({
      minWidthRem: breakpoint ? (BREAKPOINT_REM[breakpoint] ?? 0) : 0,
      gap: Number(scale) * SPACING_UNIT_PX,
    });
  }
  return gaps;
}

describe('POST_CARD_GRID 클래스와 파생 상수 일치', () => {
  it('행 간격 브레이크포인트가 클래스 문자열과 일치한다', () => {
    expect(byMinWidthDesc(parseGap(POST_CARD_GRID.className))).toEqual(
      byMinWidthDesc(POST_CARD_GRID.rowGap)
    );
  });
});
