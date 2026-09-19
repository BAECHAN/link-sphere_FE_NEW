import { describe, expect, it } from 'vitest';
import {
  BOOKMARK_GRID_CLASS,
  BOOKMARK_GRID_COLUMNS,
  BOOKMARK_GRID_ROW_GAP,
} from '@/widgets/bookmark/bookmark-post-list/config/bookmark-grid.const';

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

function parseGridColumns(className: string) {
  // 클래스 문자열 자체에 접두사 없는 grid-cols-1이 항상 있으므로(Tailwind 관례) 별도
  // 기본값을 미리 채워두지 않는다 - 채우면 아래에서 파싱된 값과 중복된다
  const columns: { minWidth: number; count: number }[] = [];
  for (const token of className.split(' ')) {
    const match = /^(?:([a-z0-9]+):)?grid-cols-(\d+)$/.exec(token);
    if (!match) {
      continue;
    }
    const [, breakpoint, count] = match;
    columns.push({
      minWidth: breakpoint ? (BREAKPOINT_PX[breakpoint] ?? 0) : 0,
      count: Number(count),
    });
  }
  return columns;
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

describe('BOOKMARK_GRID_CLASS와 파생 상수 일치', () => {
  it('열 수 브레이크포인트가 클래스 문자열과 일치한다', () => {
    expect(byMinWidthDesc(parseGridColumns(BOOKMARK_GRID_CLASS))).toEqual(
      byMinWidthDesc(BOOKMARK_GRID_COLUMNS)
    );
  });

  it('행 간격 브레이크포인트가 클래스 문자열과 일치한다', () => {
    expect(byMinWidthDesc(parseGap(BOOKMARK_GRID_CLASS))).toEqual(
      byMinWidthDesc(BOOKMARK_GRID_ROW_GAP)
    );
  });
});
