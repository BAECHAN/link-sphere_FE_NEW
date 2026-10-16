import { usePrefetchQuery, useQuery } from '@tanstack/react-query';
import { categoryKeys } from '@/entities/category/api/category.keys';
import { categoryApi } from '@/entities/category/api/category.api';
import { STALE_TIME_ONE_DAY } from '@/shared/config/const';

/**
 * 카테고리 옵션 조회
 * @returns SelectOptionType<string>[]
 */
export const useFetchCategoryOptionQuery = () => {
  return useQuery({
    queryKey: categoryKeys.categoryOption,
    queryFn: () => categoryApi.fetchCategoryOption(),
    staleTime: STALE_TIME_ONE_DAY,
  });
};

/**
 * 렌더 중에 카테고리 요청을 시작만 하고 기다리지 않는다 — useFetchCategoryOptionQuery 와 동일 키/queryFn.
 * useQuery는 커밋 뒤에야 요청하므로, 그보다 앞서(피드 라우트의 PostFeedRoute) 불러 필터 카드의 칩이
 * 첫 커밋에 들어오게 한다
 * (https://github.com/tanstack/query/blob/main/docs/framework/react/guides/prefetching.md).
 */
export const usePrefetchCategoryOptions = () => {
  usePrefetchQuery({
    queryKey: categoryKeys.categoryOption,
    queryFn: () => categoryApi.fetchCategoryOption(),
  });
};
