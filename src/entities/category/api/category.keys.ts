import type { QueryClient } from '@tanstack/react-query';

const rootKey = ['category'] as const;

export const categoryKeys = {
  root: rootKey,
  categoryOption: [...rootKey, 'category-option'] as const,
};

export const categoryInvalidateQueries = {
  all: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: rootKey });
  },
  categoryOption: (queryClient: QueryClient) => {
    queryClient.invalidateQueries({ queryKey: categoryKeys.categoryOption });
  },
};
