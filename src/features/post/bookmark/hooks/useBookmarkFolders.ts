import { useBookmarkPostMutation } from '@/entities/interaction/api/interaction.queries';
import {
  useAddBookmarkFolderMutation,
  useClearBookmarkFoldersMutation,
  useRemoveBookmarkFolderMutation,
} from '@/entities/folder/api/folder.queries';

/**
 * 북마크 폴더 선택 흐름을 한 hook으로 묶음 — FolderSelector 의 행별 동작(탭 = 즉시 저장)을 그대로 반영한다.
 *
 * - selectUncategorized: 미분류 탭 — 미북마크면 toggle(생성), 소속 있으면 전부 해제.
 *   이미 소속 0개(=이미 미분류)인 경우는 FolderSelector 에서 no-op 으로 걸러지고 여기까지 오지 않는다.
 * - selectFolder: 폴더 탭 — 비소속이면 추가(북마크 없으면 자동 생성), 소속이면 그 폴더에서만 제거.
 * - removeBookmark: 북마크 제거 행 — 북마크 자체를 완전 삭제 (소속도 전부 삭제).
 */
export function useBookmarkFolders(
  postId: string,
  isBookmarked: boolean,
  bookmarkFolderIds: string[]
) {
  const { mutateAsync: toggleBookmark } = useBookmarkPostMutation(postId);
  const { mutateAsync: addBookmarkFolder } = useAddBookmarkFolderMutation(postId);
  const { mutateAsync: removeBookmarkFolder } = useRemoveBookmarkFolderMutation(postId);
  const { mutateAsync: clearBookmarkFolders } = useClearBookmarkFoldersMutation(postId);

  const selectUncategorized = async () => {
    if (!isBookmarked) {
      await toggleBookmark();
      return;
    }
    if (bookmarkFolderIds.length > 0) {
      await clearBookmarkFolders();
    }
  };

  const selectFolder = async (folderId: string) => {
    if (bookmarkFolderIds.includes(folderId)) {
      await removeBookmarkFolder(folderId);
    } else {
      await addBookmarkFolder(folderId);
    }
  };

  const removeBookmark = async () => {
    if (isBookmarked) {
      await toggleBookmark();
    }
  };

  return { selectUncategorized, selectFolder, removeBookmark };
}
