import { useLayoutEffect } from 'react';
import {
  useUnsavedChangesStore,
  type LeaveConfirmTexts,
} from '@/shared/store/unsavedChanges.store';

/**
 * 요청을 보내고 응답을 기다리는 중임을 전역에 등록한다.
 * 그동안 useUnsavedChangesGuard는 이탈 확인창을 이 문구로 띄우고, 응답이 오면(성공·실패 모두) 그 확인창을 닫는다.
 * 이탈을 막는 건 여전히 useUnsavedChanges의 dirty 등록이다 - 이 훅은 문구와 닫는 시점만 정한다.
 *
 * @param key 폼 인스턴스를 구분하는 고유 키 (useUnsavedChanges와 같은 키를 쓴다)
 * @param isPending 응답을 기다리는 중인지
 * @param texts 그동안 이탈 확인창에 쓸 문구 - 지금 나가도 요청은 취소되지 않는다는 내용
 */
export function usePendingSubmit(key: string, isPending: boolean, texts: LeaveConfirmTexts) {
  const markPending = useUnsavedChangesStore((state) => state.markPending);
  const markSettled = useUnsavedChangesStore((state) => state.markSettled);

  // 화면을 그리기 전에 등록·해제한다 - useUnsavedChanges와 같은 이유(docs/UNSAVED-CHANGES-GUARD.md §10).
  // https://react.dev/reference/react/useLayoutEffect
  useLayoutEffect(
    function syncPendingKey() {
      if (isPending) {
        markPending(key, texts);
      } else {
        markSettled(key);
      }
      return () => markSettled(key);
    },
    [key, isPending, texts, markPending, markSettled]
  );
}
