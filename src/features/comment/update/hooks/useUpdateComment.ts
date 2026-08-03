import { useState, useCallback } from 'react';
import { useUpdateCommentMutation } from '@/entities/comment/api/comment.queries';
import { Comment } from '@/entities/comment/model/comment.schema';
import { useImagePaste } from '@/shared/hooks/useImagePaste';
import { splitContentImages } from '@/shared/lib/content/imageContent';

interface UseUpdateCommentOptions {
  comment: Comment;
  postId: string;
}

export function useUpdateComment({ comment, postId }: UseUpdateCommentOptions) {
  const { mutate: updateComment, isPending: isUpdating } = useUpdateCommentMutation(postId);

  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

  const {
    pastedImages: editPastedImages,
    imagePreviewUrls: pastedPreviewUrls,
    handlePaste: handleEditPaste,
    clearImage: clearPastedImage,
    clearAllImages: clearAllEditImages,
  } = useImagePaste();

  const editImagePreviewUrls = [...existingImageUrls, ...pastedPreviewUrls];

  const startEditing = useCallback(() => {
    const { text, imageUrls } = splitContentImages(comment.content);
    setEditContent(text);
    setExistingImageUrls(imageUrls);
    setIsEditing(true);
  }, [comment.content]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditContent(comment.content);
    setExistingImageUrls([]);
    clearAllEditImages();
  }, [comment.content, clearAllEditImages]);

  const clearEditImage = useCallback(
    (index: number) => {
      if (index < existingImageUrls.length) {
        setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
      } else {
        clearPastedImage(index - existingImageUrls.length);
      }
    },
    [existingImageUrls.length, clearPastedImage]
  );

  const handleUpdate = useCallback(() => {
    if (!editContent.trim() && editPastedImages.length === 0 && existingImageUrls.length === 0) {
      return;
    }
    updateComment(
      {
        commentId: comment.id,
        content: editContent,
        images: editPastedImages,
        existingImages: existingImageUrls,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          clearAllEditImages();
        },
      }
    );
  }, [
    comment.id,
    editContent,
    editPastedImages,
    existingImageUrls,
    updateComment,
    clearAllEditImages,
  ]);

  const canSubmit =
    (editContent.trim().length > 0 ||
      editPastedImages.length > 0 ||
      existingImageUrls.length > 0) &&
    !isUpdating;

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
