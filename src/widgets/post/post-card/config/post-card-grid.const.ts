import type { CardGridSpec } from '@/shared/hooks/useWindowGridVirtualizer';

/**
 * PostCard를 그리드로 늘어놓을 때의 치수. 피드(PostList)와 북마크(BookmarkPostList)가 같은
 * PostCard를 쓰므로 페이지가 이 값 하나를 두 목록에 넘긴다 - 목록 위젯은 카드를 모른다
 * (docs/FE-ARCHITECTURE.md §26).
 *
 * - className: 간격만 담당한다(gap-3 md:gap-4). 열 수는 useWindowGridVirtualizer가 목록
 *   컨테이너의 실측 폭으로 정해 각 행에 인라인 style(gridTemplateColumns)로 얹는다 - 사이드바를
 *   접거나 펴도(w-60/w-20) 목록이 실제로 받는 폭이 달라지는데, 뷰포트 브레이크포인트는 그
 *   차이를 반영하지 못해 카드가 찌그러지고 PostCard 푸터 아이콘이 줄바꿈됐다
 *   (docs/plans/2026-09-29-container-width-grid.md 참고).
 * - minColumnWidth: 카드가 깨지지 않는 최소 폭(px) - 직접 측정: 1280px·md+ 기준, Playwright로
 *   첫 카드 행의 폭을 1px씩 줄이며 푸터 줄바꿈·날짜 잘림·닉네임 18px 미만·넘침 중 하나가 처음
 *   생기기 직전 폭(291px)에 1px 여유를 뒀다. 최악값은 좋아요·댓글 999만(NumberUtil.formatCompact로
 *   축약), 1년 넘은 글의 긴 날짜, 내 글(⋮ 메뉴)이고 목록 카드에는 조회수가 없다. 세로 태블릿(800)이
 *   레일 사이드바로 2열을 받는 값이다. 재현 절차는 docs/plans/2026-10-28-tablet-width-rail.md 참고
 *   (그 전 값 330의 근거는 docs/plans/2026-09-29-container-width-grid.md).
 * - rowGap: className의 gap-*와 정확히 일치해야 한다 (Tailwind v4 기본 --spacing: 0.25rem = 4px)
 * - rowHeightEstimate: 열 수별 행 높이 추정치(px) - 프로덕션에서 195개 게시글 전부 로드 후
 *   실측한 중앙값(docs/plans/2026-09-19-virtualize-post-list.md Phase 0 참고). 열 수를 뷰포트가
 *   아닌 컨테이너 실측 폭으로 정하도록 바뀌며 카드 자체 폭도 달라졌지만, 이 값은
 *   measureElement가 곧 실제 높이로 보정하는 첫 렌더의 근사값일 뿐이라 재측정 없이 그대로 둔다.
 */
export const POST_CARD_GRID: CardGridSpec = {
  className: 'grid gap-3 md:gap-4',
  minColumnWidth: 292,
  maxColumns: 3,
  rowGap: [
    { minWidthRem: 48, gap: 16 },
    { minWidthRem: 0, gap: 12 },
  ],
  rowHeightEstimate: {
    3: 654,
    2: 635,
    1: 582,
  },
};
