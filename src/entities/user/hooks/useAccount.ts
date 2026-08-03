import { useEffect } from 'react';
import { useFetchAccountQuery } from '@/entities/user/api/auth.queries';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

export function useAccount() {
  const { data: account, isLoading, error, isError } = useFetchAccountQuery();

  // 다음 방문 시 useAppInitialization이 이 URL로 아바타를 선반입할 수 있도록 저장한다.
  // (React Query v5는 useQuery에 onSuccess가 없어 effect로 대체)
  useEffect(
    function persistLastAvatar() {
      if (account?.image) {
        LocalStorageUtil.setItem(STORAGE_KEYS.AUTH.LAST_AVATAR, account.image);
      }
    },
    [account?.image]
  );

  return {
    account,
    isLoading,
    error,
    isError,
    // 편의를 위한 파생 상태 (Selector 패턴)
    isLoggedIn: !!account,
  };
}
