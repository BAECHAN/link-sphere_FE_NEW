import type { SearchParams } from '@/widgets/post/post-list/utils/search-parser';

const HIDE_BOTS_FILTER = 'excludeBots';

/**
 * 범위 칩이 주소의 filter에 넣는 값. 모두 "내" 북마크·좋아요·글을 가리켜 로그인해야 뜻이 있다 -
 * 칩의 카운트·초기화(usePostListFilter)와 로그아웃 상태의 요청 차단(hasLoginOnlyFilter)이 같은 목록을 본다.
 */
export const SCOPE_FILTERS = ['isBookmarked', 'isLiked', 'isMyPosts', 'isPrivate'] as const;

/**
 * 주소의 filter에 로그인해야 뜻이 있는 값이 하나라도 있는지. 로그아웃 상태에서 이 값이 참이면 목록과
 * 미리 받기를 요청하지 않는다(usePostListLoginGate). 쉼표로 나눈 값의 앞뒤 공백을 떼고 본다 - BE가 같은
 * 방식으로 나눠 읽으므로 손으로 친 주소(`?filter=%20isMyPosts`)도 같은 기준으로 잡는다.
 */
export function hasLoginOnlyFilter(currentFilter: string | undefined): boolean {
  if (!currentFilter) {
    return false;
  }

  const filters = currentFilter.split(',').map((filter) => filter.trim());

  return SCOPE_FILTERS.some((scopeFilter) => filters.includes(scopeFilter));
}

// URL filter(칩 4개)에 옛 북마크·공유 링크가 남긴 excludeBots가 섞여 있어도 무시하고,
// 봇 숨기기 여부는 오직 localStorage 설정(useHideBotsStore)만 따른다
function buildCombinedFilter(
  currentFilter: string | undefined,
  hideBots: boolean
): string | undefined {
  const filters = (currentFilter ? currentFilter.split(',') : []).filter(
    (f) => f !== HIDE_BOTS_FILTER
  );
  if (hideBots) {
    filters.push(HIDE_BOTS_FILTER);
  }
  return filters.length > 0 ? filters.join(',') : undefined;
}

/**
 * 목록 조회 조건 — 목록 화면(usePostList)과 피드 라우트의 미리 받기(usePostFeedPrefetch)가 이 함수로
 * 만들어야 같은 캐시 키를 가리킨다. 미리 받기는 lazy 페이지 청크 밖에서 돌아 usePostList.ts를 import할
 * 수 없으므로(가상화 코드까지 첫 로딩 청크로 끌려온다) 조건 계산만 이 파일로 뺐다.
 */
export function toPostListPayload(
  { category, nickname, search }: SearchParams,
  currentFilter: string | undefined,
  hideBots: boolean
) {
  return { search, category, nickname, filter: buildCombinedFilter(currentFilter, hideBots) };
}
