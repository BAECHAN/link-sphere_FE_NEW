import { useQuery } from '@tanstack/react-query';
import { commonKeys } from '@/shared/api/common.keys';
import { commonApi } from '@/shared/api/common.api';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { STALE_TIME_ONE_DAY } from '@/shared/config/const';

/**
 * 카테고리 옵션 조회
 * @returns SelectOptionType<string>[]
 */
export const useFetchCategoryOptionQuery = () => {
  return useQuery({
    queryKey: commonKeys.categoryOption,
    queryFn: () => commonApi.fetchCategoryOption(),
    staleTime: STALE_TIME_ONE_DAY,
  });
};

/**
 * 공통 데이터 프리패칭 함수
 * 로그인 성공 직후나 앱 초기화 시 호출하여 데이터를 미리 로드합니다.
 */
export const prefetchCommonData = () => {
  queryClient.prefetchQuery({
    queryKey: commonKeys.categoryOption,
    queryFn: commonApi.fetchCategoryOption,
  });
};
