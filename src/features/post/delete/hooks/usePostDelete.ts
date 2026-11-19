import { useDeletePostMutation } from '@/entities/post/api/post.queries';

import { TEXTS } from '@/shared/config/texts';
import { useAlertDialog } from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';

export function usePostDelete() {
  const { mutateAsync: deletePost, isPending: isDeleting } = useDeletePostMutation();
  const { openConfirm } = useAlertDialog();

  const handleDeleteClick = (postId: string, options?: { onSuccess?: () => void }) => {
    openConfirm({
      message: TEXTS.messages.warning.postDeleteConfirm,
      confirmText: TEXTS.buttons.delete,
      onConfirm: async () => {
        await deletePost(postId);
        options?.onSuccess?.();
      },
    });
  };

  return {
    onDelete: handleDeleteClick,
    isDeleting,
  };
}
