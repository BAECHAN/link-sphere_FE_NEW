import type { SearchParams } from '@/widgets/post/post-list/utils/search-parser';

const HIDE_BOTS_FILTER = 'excludeBots';

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
