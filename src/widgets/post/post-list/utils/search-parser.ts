export interface SearchParams {
  category?: string;
  nickname?: string;
  search?: string;
}

/**
 * 태그는 문자열 시작이나 공백 뒤에서만 시작하고, 다음 공백 또는 다음 @/# 에서 끝난다.
 * - 시작 경계: `hong@example.com`의 @를 태그로 오인하지 않기 위함
 * - 끝 경계:   `@a@b`처럼 붙여 쓴 태그를 각각으로 읽기 위함
 * 두 상수 모두 g 플래그지만 match/replace에만 쓴다(둘 다 lastIndex를 0으로 리셋한다).
 * test()/exec()에 쓰면 호출 간 상태가 남으므로 쓰지 않는다.
 */
const TAG_RUN = /(?:^|\s)(?:[@#][^\s@#]+)+/g;
const TAG_TOKEN = /[@#][^\s@#]+/g;

/** 검색어에서 @·# 태그를 등장 순서대로 추출한다. 예: '리액트 @A@B' -> ['@A', '@B'] */
export const extractSearchTags = (query: string): string[] =>
  (query.match(TAG_RUN) ?? []).flatMap((run) => run.match(TAG_TOKEN) ?? []);

/**
 * 검색어에서 @카테고리 및 #닉네임 태그를 추출합니다.
 * 예: "@DevOps #테스트 리액트" -> { category: 'DevOps', nickname: '테스트', search: '리액트' }
 */
export const parseSearchQuery = (query: string): SearchParams => {
  if (!query) {
    return {};
  }

  const tags = extractSearchTags(query);

  // @로 시작하는 태그를 제거하고 콤마로 연결
  const categoryTags = tags.filter((tag) => tag.startsWith('@'));
  const category = categoryTags.length
    ? categoryTags.map((tag) => tag.substring(1)).join(',')
    : undefined;

  // #으로 시작하는 태그를 제거하고 콤마로 연결
  // 주의: 백엔드는 이 콤마 구분 문자열을 split하지 않고 LIKE 패턴 전체에 그대로 넣는다
  // (PostRepositoryImpl.kt:153-168) - 즉 닉네임을 2개 이상 지정하면 결과가 0건이 된다.
  // 알려진 백엔드 버그이며 이 함수의 책임 밖이다 (docs/SEARCH.md §11 참고)
  const nicknameTags = tags.filter((tag) => tag.startsWith('#'));
  const nickname = nicknameTags.length
    ? nicknameTags.map((tag) => tag.substring(1)).join(',')
    : undefined;

  // @카테고리, #닉네임 부분을 모두 제거하고 남은 문자열을 검색어로 사용
  const search = query.replace(TAG_RUN, ' ').replace(/\s+/g, ' ').trim() || undefined;

  return {
    category,
    nickname,
    search,
  };
};
