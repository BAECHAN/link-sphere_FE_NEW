import { useQuery } from '@tanstack/react-query';
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
