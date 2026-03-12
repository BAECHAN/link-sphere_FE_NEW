import { queryClient } from '@/shared/lib/react-query/config/queryClient';

export const authKeys = {
  root: () => ['auth'] as const,
  account: () => [...authKeys.root(), 'account'] as const,
};

export const authInvalidateQueries = {
  all: () => {
    queryClient.invalidateQueries({ queryKey: authKeys.root() });
  },
  account: () => {
    queryClient.invalidateQueries({ queryKey: authKeys.account() });
  },
};
