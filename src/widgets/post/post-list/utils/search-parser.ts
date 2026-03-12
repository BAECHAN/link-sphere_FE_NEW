export interface SearchParams {
  category?: string;
  nickname?: string;
  search?: string;
}

/**
 * 검색어에서 @카테고리 및 #닉네임 태그를 추출합니다.
 * 예: "@DevOps #테스트 리액트" -> { category: 'DevOps', nickname: '테스트', search: '리액트' }
 */
export const parseSearchQuery = (query: string): SearchParams => {
  if (!query) return {};

  // 모든 @카테고리 패턴 추출
  const categoryMatches = query.match(/@(\S+)/g);

  // 모든 #닉네임 패턴 추출
  const nicknameMatches = query.match(/#(\S+)/g);

  // @를 제거하고 콤마로 연결
  const category = categoryMatches
    ? categoryMatches.map((tag) => tag.substring(1)).join(',')
    : undefined;

  // #을 제거하고 콤마로 연결 (여러 개일 경우 콤마 구분되나, 백엔드는 1개만 처리하더라도 일단 연결)
  const nickname = nicknameMatches
    ? nicknameMatches.map((tag) => tag.substring(1)).join(',')
    : undefined;

  // @카테고리, #닉네임 부분을 모두 제거하고 남은 문자열을 검색어로 사용
  const search =
    query
      .replace(/@(\S+)/g, '')
      .replace(/#(\S+)/g, '')
      .replace(/\s+/g, ' ')
      .trim() || undefined;

  return {
    category,
    nickname,
    search,
  };
};
