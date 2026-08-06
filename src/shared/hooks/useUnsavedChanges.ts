import { useEffect } from 'react';
import { clearUnsavedChanges, useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';

/**
 * 저장하지 않은 입력이 있음을 전역에 등록한다.
 * 등록된 키가 하나라도 있으면 useUnsavedChangesGuard가 페이지 이탈을 막는다.
 *
 * @param key 폼 인스턴스를 구분하는 고유 키 (예: `comment-create:${postId}:root`)
 * @param isDirty 저장하지 않은 입력이 있는지
 * @returns clearNow 제출 직후처럼 "지금 즉시" 해제해야 할 때 동기 호출
 */
export function useUnsavedChanges(key: string, isDirty: boolean) {
  const markDirty = useUnsavedChangesStore((state) => state.markDirty);
  const markClean = useUnsavedChangesStore((state) => state.markClean);

  useEffect(
    function syncDirtyKey() {
      if (isDirty) {
        markDirty(key);
      } else {
        markClean(key);
      }
      return () => markClean(key);
    },
    [key, isDirty, markDirty, markClean]
  );

  const clearNow = () => clearUnsavedChanges(key);

  return { clearNow };
}
