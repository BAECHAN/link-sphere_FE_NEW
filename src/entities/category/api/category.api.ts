import { specClient } from '@/shared/api/spec-client';
import { SelectOptionType } from '@/shared/types/common.type';
import { CategoryOption } from '@/entities/category/model/category.schema';

const fetchCategoryOption = async (): Promise<SelectOptionType[]> => {
  const response = await specClient.get('/common/category-option');
  return response.map((item: CategoryOption) => {
    return {
      label: item.name,
      value: String(item.id),
    };
  });
};

export const categoryApi = {
  fetchCategoryOption,
};
