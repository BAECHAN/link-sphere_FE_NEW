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
    pastedImage: editPastedImage,
    setPastedImage: setEditPastedImage,
    imagePreviewUrl: editImagePreviewUrl,
    handlePaste: handleEditPaste,
    clearImage: clearEditImage,
  } = useImagePaste();

  const startEditing = useCallback(() => {
    setIsEditing(true);
  }, []);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent(comment.content);
    setEditPastedImage(null);
  }, [comment.content, setEditPastedImage]);

  const handleUpdate = useCallback(() => {
    if (!editContent.trim() && !editPastedImage) return;
    updateComment(
      { commentId: comment.id, content: editContent, image: editPastedImage },
      {
        onSuccess: () => {
          setIsEditing(false);
          setEditPastedImage(null);
        },
      }
    );
  }, [comment.id, editContent, editPastedImage, updateComment, setEditPastedImage]);

  const canSubmit = (editContent.trim().length > 0 || !!editPastedImage) && !isUpdating;

  return {
    isEditing,
    editContent,
    editImagePreviewUrl,
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
