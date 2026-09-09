import { useFetchCategoryOptionQuery } from '@/entities/category/api/category.queries';

/**
 * 카테고리 옵션 목록 — 등록·수정 폼의 관심 분야 체크박스와 목록 검색 카드의 @카테고리 칩이
 * 같은 쿼리(categoryKeys.categoryOption)를 공유한다. 로딩·에러 중에는 빈 목록으로 떨어뜨려
 * 호출부마다 `?? []`를 반복하지 않게 한다.
 */
export function useCategoryOptions() {
  const { data } = useFetchCategoryOptionQuery();

  return {
    categoryOptionList: data ?? [],
  };
}
