import { useBookmarkPostMutation } from '@/entities/interaction/api/interaction.queries';
import { useMoveBookmarkMutation } from '@/entities/folder/api/folder.queries';

/**
 * 북마크 저장 + 폴더 지정 흐름을 한 hook으로 묶음.
 *
 * - 북마크가 아직 없으면 toggleBookmark (미분류로 ON) 먼저 호출
 * - 다음 folderId 가 현재 상태와 다르면 moveBookmark 호출
 * - removeBookmark: 이미 북마크된 경우만 toggleBookmark (OFF)
 *
 * BE 시퀀스 제약: 단건 moveBookmark 는 사전에 본인 북마크가 존재해야 함 (404 회피).
 */
export function useBookmarkWithFolder(
  postId: string,
  isBookmarked: boolean,
  currentFolderId: string | null
) {
  const { mutateAsync: toggleBookmark } = useBookmarkPostMutation(postId);
  const { mutateAsync: moveBookmark } = useMoveBookmarkMutation(postId);

  const saveToFolder = async (folderId: string | null) => {
    if (!isBookmarked) {
      await toggleBookmark(); // 미분류로 추가 (folder_id 자동 null)
    }
    const targetFolderId = folderId ?? null;
    const fromFolderId = isBookmarked ? currentFolderId : null;
    if (targetFolderId !== fromFolderId) {
      await moveBookmark({ folderId: targetFolderId });
    }
  };

  const removeBookmark = async () => {
    if (isBookmarked) {
      await toggleBookmark();
    }
  };

  return { saveToFolder, removeBookmark };
}
