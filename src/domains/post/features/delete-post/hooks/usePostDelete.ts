import { useDeletePostMutation } from '@/domains/post/_common/api/post.queries';

import { TEXTS } from '@/shared/config/texts';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';

export function usePostDelete() {
  const { mutateAsync: deletePost, isPending: isDeleting } = useDeletePostMutation();
  const { openConfirm } = useAlert();

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
