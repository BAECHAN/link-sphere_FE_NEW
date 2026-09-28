import { useDeleteCommentMutation } from '@/entities/comment/api/comment.queries';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';

interface UseDeleteCommentOptions {
  postId: string;
}

export function useDeleteComment({ postId }: UseDeleteCommentOptions) {
  const { mutateAsync: deleteComment, isPending: isDeleting } = useDeleteCommentMutation(postId);
  const { openConfirm } = useAlert();

  const onDelete = (commentId: string, options?: { onSuccess?: () => void }) => {
    openConfirm({
      message: TEXTS.messages.warning.commentDeleteConfirm,
      confirmText: TEXTS.buttons.delete,
      // 이미 삭제를 결심하고 도달한 다이얼로그다 - usePostDelete.ts와 동일 이유로
      // 확인을 채움+오른쪽으로 켠다(docs/DECISIONS.md 2026-09-29 항목).
      emphasis: 'confirm',
      onConfirm: async () => {
        await deleteComment(commentId);
        options?.onSuccess?.();
      },
    });
  };

  return {
    onDelete,
    isDeleting,
  };
}
