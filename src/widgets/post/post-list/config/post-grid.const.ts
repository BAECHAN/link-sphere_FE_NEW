import type { GapBreakpoint } from '@/shared/hooks/useWindowGridVirtualizer';

/**
 * PostList 카드 그리드의 클래스 문자열 - 간격만 담당한다(gap-3 md:gap-4). 열 수는
 * 더 이상 뷰포트 브레이크포인트가 아니라 useWindowGridVirtualizer가 목록 컨테이너의
 * 실측 폭으로 정해 각 행에 인라인 style(gridTemplateColumns)로 얹는다 - 사이드바를
 * 접거나 펴도(w-60/w-20) 목록이 실제로 받는 폭이 달라지는데, 뷰포트 브레이크포인트는
 * 그 차이를 반영하지 못해 카드가 찌그러지고 PostCard 푸터 아이콘이 줄바꿈됐다
 * (docs/plans/2026-09-29-container-width-grid.md 참고).
 */
export const POST_GRID_CLASS = 'grid gap-3 md:gap-4';

/**
 * PostCard 푸터(좋아요/댓글 pill + 북마크·공유 + 조회수)가 한 줄을 유지하는 최소 카드
 * 폭(px) - 직접 측정: 1280px·md+ 기준, Playwright로 좋아요·댓글 999, 조회수 99,999인
 * 카드의 푸터를 position:absolute로 띄워 getBoundingClientRect().width + Card 보더
 * 2px(border 기본값)을 잰 값(329px)을 올림. 측정 스크립트·재현 절차는
 * docs/plans/2026-09-29-container-width-grid.md 참고.
 */
export const POST_GRID_MIN_COLUMN_WIDTH = 330;

export const POST_GRID_MAX_COLUMNS = 3;

/** 위 클래스의 gap-*와 정확히 일치해야 한다 (Tailwind v4 기본 --spacing: 0.25rem = 4px) */
export const POST_GRID_ROW_GAP: readonly GapBreakpoint[] = [
  { minWidth: 768, gap: 16 },
  { minWidth: 0, gap: 12 },
];

/**
 * 열 수별 행 높이 추정치(px) - 프로덕션에서 195개 게시글 전부 로드 후 실측한 중앙값
 * (docs/plans/2026-09-19-virtualize-post-list.md Phase 0 참고). 열 수를 뷰포트가 아닌
 * 컨테이너 실측 폭으로 정하도록 바뀌며 카드 자체 폭도 달라졌지만, 이 값은 measureElement가
 * 곧 실제 높이로 보정하는 첫 렌더의 근사값일 뿐이라 재측정 없이 그대로 둔다.
 */
export const POST_GRID_ROW_HEIGHT_ESTIMATE: Readonly<Record<number, number>> = {
  3: 654,
  2: 635,
  1: 582,
};
