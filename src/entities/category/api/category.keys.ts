import { queryClient } from '@/shared/lib/react-query/config/queryClient';

const rootKey = ['category'] as const;

export const categoryKeys = {
  root: rootKey,
  categoryOption: [...rootKey, 'category-option'] as const,
};

export const categoryInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  categoryOption: () => {
    queryClient.invalidateQueries({ queryKey: categoryKeys.categoryOption });
  },
};
