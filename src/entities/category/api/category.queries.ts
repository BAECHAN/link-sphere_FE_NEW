import { useQuery, type QueryClient } from '@tanstack/react-query';
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
 * 카테고리 데이터 프리패칭 함수
 * 로그인 성공 직후나 앱 초기화 시 호출하여 데이터를 미리 로드합니다.
 */
export const prefetchCategoryData = (queryClient: QueryClient) => {
  queryClient.prefetchQuery({
    queryKey: categoryKeys.categoryOption,
    queryFn: categoryApi.fetchCategoryOption,
  });
};
