import { useBookmarkPostMutation } from '@/entities/interaction/api/interaction.queries';
import {
  useAddBookmarkFolderMutation,
  useClearBookmarkFoldersMutation,
  useRemoveBookmarkFolderMutation,
} from '@/entities/bookmark/folder/api/bookmark-folder.queries';

/**
 * 북마크 폴더 선택 흐름을 한 hook으로 묶음 — PostCardBookmarkFolderDialog 의 행별 동작(탭 = 즉시 저장)을 그대로 반영한다.
 * 저장·해제는 토글이 아니라 원하는 상태(setBookmark(true|false))를 보낸다 — 방향은 화면에 보이는 상태(props)로
 * 정한다(2026-10-13, docs/plans/2026-10-13-bookmark-set-state.md).
 *
 * - selectUncategorized: 미분류 탭 — 미북마크면 저장, 소속 있으면 전부 해제,
 *   이미 미분류(소속 0개)면 완전 삭제(2026-09-11 변경). 되돌리기는 restoreBookmark로.
 * - selectFolder: 폴더 탭 — 비소속이면 추가(북마크 없으면 자동 생성), 소속이면 그 폴더에서만 제거.
 *   단, 그 폴더가 유일한 소속(마지막 폴더)이면 미분류로 남기지 않고 북마크 자체를 완전
 *   삭제한다(2026-09-11 변경 — 되돌리기는 restoreFolder로).
 * - restoreFolder: selectFolder가 마지막 폴더를 삭제한 뒤 되돌리기 토스트에서 쓰는 복원 —
 *   addBookmarkFolder를 그대로 재사용한다("북마크 보장 + 소속 보장"이 멱등이라 정확히 원복됨).
 * - removeBookmark: 북마크 제거 행 — 북마크 자체를 완전 삭제 (소속도 전부 삭제). 멱등이라 화면 상태와
 *   상관없이 보낸다(다른 기기에서 이미 지웠어도 그대로 지워진 채로 끝난다).
 * - restoreBookmark: removeBookmark·selectUncategorized(미분류 재탭) 되돌리기 토스트에서
 *   쓰는 복원 — 삭제 전 소속이 0개였으면 저장으로(미분류로 생성됨),
 *   있었으면 그 폴더들에 addBookmarkFolder를 다시 호출한다.
 */
export function useBookmarkFolders(
  postId: string,
  isBookmarked: boolean,
  bookmarkFolderIds: string[]
) {
  const { mutateAsync: setBookmark } = useBookmarkPostMutation(postId);
  const { mutateAsync: addBookmarkFolder } = useAddBookmarkFolderMutation(postId);
  const { mutateAsync: removeBookmarkFolder } = useRemoveBookmarkFolderMutation(postId);
  const { mutateAsync: clearBookmarkFolders } = useClearBookmarkFoldersMutation(postId);

  const selectUncategorized = async () => {
    if (isBookmarked && bookmarkFolderIds.length > 0) {
      await clearBookmarkFolders();
      return;
    }

    // 미북마크면 저장, 이미 미분류(소속 0개)면 완전 삭제
    await setBookmark(!isBookmarked);
  };

  const selectFolder = async (folderId: string) => {
    if (!bookmarkFolderIds.includes(folderId)) {
      await addBookmarkFolder(folderId);
      return;
    }
    const isLastFolder = bookmarkFolderIds.length === 1;
    if (isLastFolder) {
      await setBookmark(false);
    } else {
      await removeBookmarkFolder(folderId);
    }
  };

  const restoreFolder = async (folderId: string) => {
    await addBookmarkFolder(folderId);
  };

  const removeBookmark = async () => {
    await setBookmark(false);
  };

  const restoreBookmark = async (prevFolderIds: string[]) => {
    if (prevFolderIds.length === 0) {
      await setBookmark(true);
      return;
    }
    await Promise.all(prevFolderIds.map((folderId) => addBookmarkFolder(folderId)));
  };

  return {
    selectUncategorized,
    selectFolder,
    restoreFolder,
    removeBookmark,
    restoreBookmark,
  };
}
