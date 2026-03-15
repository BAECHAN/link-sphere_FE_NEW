import { useState, useCallback } from 'react';
import { useUpdateCommentMutation } from '@/entities/comment/api/comment.queries';
import { Comment } from '@/entities/comment/model/comment.schema';
import { useImagePaste } from '@/shared/hooks/useImagePaste';

interface UseUpdateCommentOptions {
  comment: Comment;
  postId: string;
}

export function useUpdateComment({ comment, postId }: UseUpdateCommentOptions) {
  const { mutateAsync: updateComment, isPending: isUpdating } = useUpdateCommentMutation(postId);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const {
    pastedImages: editPastedImages,
    imagePreviewUrls: editImagePreviewUrls,
    handlePaste: handleEditPaste,
    clearImage: clearEditImage,
    clearAllImages: clearAllEditImages,
  } = useImagePaste();

  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent(comment.content);
    clearAllEditImages();
  }, [comment.content, clearAllEditImages]);

  const handleUpdate = useCallback(() => {
    if (!editContent.trim() && editPastedImages.length === 0) return;
    updateComment(
      { commentId: comment.id, content: editContent, images: editPastedImages },
      {
        onSuccess: () => {
          setIsEditing(false);
          clearAllEditImages();
        },
      }
    );
  }, [comment.id, editContent, editPastedImages, updateComment, clearAllEditImages]);

  const canSubmit = (editContent.trim().length > 0 || editPastedImages.length > 0) && !isUpdating;

  return {
    isEditing,
    editContent,
    editImagePreviewUrls,
    isUpdating,
    canSubmit,
    setEditContent,
    startEditing,
    cancelEditing,
    handleEditPaste,
    clearEditImage,
    handleUpdate,
  };
}
