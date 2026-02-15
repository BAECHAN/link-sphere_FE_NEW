import { useFetchAccountQuery } from '@/domains/auth/_common/api/auth.queries';

export function useAccount() {
  const { data: account, isLoading, error, isError } = useFetchAccountQuery();

  return {
    account,
    isLoading,
    error,
    isError,
    // 편의를 위한 파생 상태 (Selector 패턴)
    isLoggedIn: !!account,
  };
}
