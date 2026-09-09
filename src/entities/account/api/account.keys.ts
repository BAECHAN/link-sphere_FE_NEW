import type { QueryClient } from '@tanstack/react-query';
import { postInvalidateQueries } from '@/entities/post/api/post.keys';
import { commentInvalidateQueries } from '@/entities/comment/api/comment.keys';
import { bookmarkFolderInvalidateQueries } from '@/entities/bookmark/folder/api/bookmark-folder.keys';

const rootKey = ['account'] as const;

export const accountMutationKeys = {
  update: [...rootKey, 'update'] as const,
};

export const accountKeys = {
  root: rootKey,
};

/**
 * 프로필(닉네임·이미지) 변경 후 - 작성자 정보가 비정규화되어 실려오는 캐시를 전부 재검증한다.
 * BE는 댓글·게시글의 author를 members에서 매 요청 조인해 내려주므로 재조회만 하면 새 값이 온다.
 * account는 mutation의 onMutate/onSuccess가 낙관적으로 캐시를 직접 쓰므로 여기서 invalidate하지
 * 않는다 (handleCommentCreateSuccess와 동일한 이유: 이미 쓴 값을 지우고 GET을 한 번 더 태우게 된다).
 */
export const handleAccountUpdateSuccess = (queryClient: QueryClient) => {
  postInvalidateQueries.all(queryClient); // 목록 + 상세의 author
  commentInvalidateQueries.all(queryClient); // 모든 게시글의 댓글 author
  bookmarkFolderInvalidateQueries.postsRoot(queryClient); // 폴더별 게시글 카드의 author
};
