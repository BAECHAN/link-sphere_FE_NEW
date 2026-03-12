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
