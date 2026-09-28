import type { GapBreakpoint } from '@/shared/hooks/useWindowGridVirtualizer';
import {
  POST_GRID_MAX_COLUMNS,
  POST_GRID_MIN_COLUMN_WIDTH,
} from '@/widgets/post/post-list/config/post-grid.const';

/**
 * BookmarkPostList 카드 그리드의 클래스 문자열 - 간격만 담당한다. PostList와 같은
 * PostCard를 쓰므로 최소 카드 폭도 POST_GRID_MIN_COLUMN_WIDTH를 그대로 재사용한다
 * (post-grid.const.ts 주석 참고). 열 수는 useWindowGridVirtualizer가 목록 컨테이너의
 * 실측 폭으로 정한다 - 이 페이지는 폴더트리(w-60 + gap-6)까지 폭을 가져가므로 이전에는
 * 3열 전환 브레이크포인트를 xl(1280px)로 따로 늦췄었지만, 실측 폭 기준으로 바뀌며 그
 * 조정이 더 이상 필요 없다.
 */
export const BOOKMARK_GRID_CLASS = 'grid gap-3 md:gap-4';

export const BOOKMARK_GRID_MIN_COLUMN_WIDTH = POST_GRID_MIN_COLUMN_WIDTH;

export const BOOKMARK_GRID_MAX_COLUMNS = POST_GRID_MAX_COLUMNS;

/** 위 클래스의 gap-*와 정확히 일치해야 한다 (Tailwind v4 기본 --spacing: 0.25rem = 4px) */
export const BOOKMARK_GRID_ROW_GAP: readonly GapBreakpoint[] = [
  { minWidth: 768, gap: 16 },
  { minWidth: 0, gap: 12 },
];

/**
 * 열 수별 행 높이 추정치(px) - PostList와 같은 PostCard를 쓰므로 같은 값을 쓴다
 * (docs/plans/2026-09-19-virtualize-post-list.md Phase 0 참고).
 */
export const BOOKMARK_GRID_ROW_HEIGHT_ESTIMATE: Readonly<Record<number, number>> = {
  3: 654,
  2: 635,
  1: 582,
};
