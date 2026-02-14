import { API_ENDPOINTS } from '@/shared/config/api';
import { apiClient } from '@/shared/api/client';
import { SelectOptionType } from '@/shared/types/common.type';
import { CategoryOption } from '@/shared/api/common.schema';

const fetchCategoryOption = async (): Promise<SelectOptionType[]> => {
  const response = await apiClient.get<CategoryOption[]>(API_ENDPOINTS.common.categoryOption);
  return response.map((item: CategoryOption) => {
    return {
      label: item.name,
      value: String(item.id),
    };
  });
};

export const commonApi = {
  fetchCategoryOption,
};
