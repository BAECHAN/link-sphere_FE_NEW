import type { ColumnBreakpoint, GapBreakpoint } from '@/shared/hooks/useWindowGridVirtualizer';

/**
 * PostList 카드 그리드의 클래스 문자열. 이 문자열이 단일 출처이고, 아래 열 수·행
 * 간격 상수는 여기 맞춰 손으로 유지한다 - 어긋나면 post-grid.const.test.ts가 잡는다.
 */
export const POST_GRID_CLASS = 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4';

/** 위 클래스의 grid-cols-*와 정확히 일치해야 한다 (Tailwind 기본 브레이크포인트: md=768, lg=1024) */
export const POST_GRID_COLUMNS: readonly ColumnBreakpoint[] = [
  { minWidth: 1024, count: 3 },
  { minWidth: 768, count: 2 },
  { minWidth: 0, count: 1 },
];

/** 위 클래스의 gap-*와 정확히 일치해야 한다 (Tailwind v4 기본 --spacing: 0.25rem = 4px) */
export const POST_GRID_ROW_GAP: readonly GapBreakpoint[] = [
  { minWidth: 768, gap: 16 },
  { minWidth: 0, gap: 12 },
];

/**
 * 열 수별 행 높이 추정치(px) - 프로덕션에서 195개 게시글 전부 로드 후 실측한 중앙값
 * (docs/plans/2026-09-19-virtualize-post-list.md Phase 0 참고). measureElement가 곧
 * 실제 높이로 보정하므로 첫 렌더의 문서 높이 근사값 정도로만 정확하면 된다.
 */
export const POST_GRID_ROW_HEIGHT_ESTIMATE: Readonly<Record<number, number>> = {
  3: 654,
  2: 635,
  1: 582,
};
