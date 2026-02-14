import { queryClient } from '@/shared/lib/react-query/config/queryClient';

const rootKey = ['common'] as const;

export const commonKeys = {
  root: rootKey,
  categoryOption: [...rootKey, 'category-option'] as const,
};

export const commonInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  categoryOption: () => {
    queryClient.invalidateQueries({ queryKey: commonKeys.categoryOption });
  },
};
