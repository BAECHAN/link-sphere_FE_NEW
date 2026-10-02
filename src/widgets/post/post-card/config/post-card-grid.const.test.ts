import { describe, expect, it } from 'vitest';
import { POST_CARD_GRID } from '@/widgets/post/post-card/config/post-card-grid.const';

// Tailwind 기본 브레이크포인트(px) - globals.css에 재정의 없음(grep으로 확인)
const BREAKPOINT_PX: Record<string, number> = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
};

// Tailwind v4 기본 --spacing: 0.25rem = 4px (design-tokens skill 참고, globals.css 재정의 없음)
const SPACING_UNIT_PX = 4;

function byMinWidthDesc<T extends { minWidth: number }>(list: readonly T[]): T[] {
  return [...list].sort((a, b) => b.minWidth - a.minWidth);
}

function parseGap(className: string) {
  const gaps: { minWidth: number; gap: number }[] = [];
  for (const token of className.split(' ')) {
    const match = /^(?:([a-z0-9]+):)?gap-(\d+)$/.exec(token);
    if (!match) {
      continue;
    }
    const [, breakpoint, scale] = match;
    gaps.push({
      minWidth: breakpoint ? (BREAKPOINT_PX[breakpoint] ?? 0) : 0,
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
