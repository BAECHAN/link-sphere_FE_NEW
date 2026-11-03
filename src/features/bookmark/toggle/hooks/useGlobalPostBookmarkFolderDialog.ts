import { useEffect } from 'react';
import { useBackClosableOverlay } from '@/shared/hooks/useBackClosableOverlay';
import {
  POST_BOOKMARK_FOLDER_DIALOG_KEY,
  usePostBookmarkFolderDialogStore,
} from '@/features/bookmark/toggle/hooks/postBookmarkFolderDialog.store';

/**
 * 화면 수준 북마크 폴더 선택 창의 열림 상태. 뒤로가기로 닫히는 열림(useBackClosableOverlay)은 이 훅 하나만
 * 쓴다 - CloseWatcher가 창마다 하나라 카드 수와 상관없다. 무엇을 보여 줄지는 버튼이 넣은 스토어 대상(target)이다.
 */
export function useGlobalPostBookmarkFolderDialog() {
  const target = usePostBookmarkFolderDialogStore((state) => state.target);
  const { isOpen, close } = useBackClosableOverlay(POST_BOOKMARK_FOLDER_DIALOG_KEY);
  const hasTarget = target !== null;

  // 열린 엔트리인데 대상이 없으면(창을 연 채 새로고침해 스토어가 비었을 때) 엔트리를 닫는다 - 어느 글의
  // 창인지 모르는 채로 띄우지 않는다
  useEffect(
    function closeEntryWithoutTarget() {
      if (isOpen && !hasTarget) {
        close();
      }
    },
    [isOpen, hasTarget, close]
  );

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      close();
    }
  };

  return { target, isOpen: isOpen && hasTarget, handleOpenChange };
}
