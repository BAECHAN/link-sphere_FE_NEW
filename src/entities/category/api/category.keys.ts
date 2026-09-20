const rootKey = ['category'] as const;

export const categoryKeys = {
  root: rootKey,
  categoryOption: [...rootKey, 'category-option'] as const,
};
