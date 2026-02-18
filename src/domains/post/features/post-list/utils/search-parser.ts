export interface SearchParams {
  category?: string;
  search?: string;
}

/**
 * 검색어에서 @카테고리 태그를 추출합니다.
 * 예: "@DevOps @React 리액트" -> { category: 'DevOps,React', search: '리액트' }
 */
export const parseSearchQuery = (query: string): SearchParams => {
  if (!query) return {};

  // 모든 @카테고리 패턴 추출
  const categoryMatches = query.match(/@(\S+)/g);

  // @를 제거하고 콤마로 연결
  const category = categoryMatches
    ? categoryMatches.map((tag) => tag.substring(1)).join(',')
    : undefined;

  // @카테고리 부분을 모두 제거하고 남은 문자열을 검색어로 사용
  const search =
    query
      .replace(/@(\S+)/g, '')
      .replace(/\s+/g, ' ')
      .trim() || undefined;

  return {
    category,
    search,
  };
};
