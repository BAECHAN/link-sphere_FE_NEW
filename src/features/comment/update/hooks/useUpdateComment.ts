import { useState, useCallback, useRef } from 'react';
import { useUpdateCommentMutation } from '@/entities/comment/api/comment.queries';
import { Comment } from '@/entities/comment/model/comment.schema';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/const';
import { useImageAttachments } from '@/shared/hooks/useImageAttachments';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
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
    images: editImages,
    imagePreviewUrls: editPastedPreviewUrls,
    isDraggingOver: isEditDraggingOver,
    addFiles: addEditFiles,
    handlePaste: handleEditPaste,
    handleDrop: handleEditDrop,
    handleDragOver: handleEditDragOver,
    handleDragEnter: handleEditDragEnter,
    handleDragLeave: handleEditDragLeave,
    clearImage: clearEditPastedImage,
    clearAllImages: clearAllEditImages,
  } = useImageAttachments({
    maxCount: MAX_COMMENT_IMAGES,
    reservedCount: existingImageUrls.length,
  });

  const editImagePreviewUrls = [...existingImageUrls, ...editPastedPreviewUrls];

  // 수정을 시작할 때의 원본 스냅샷 - 편집 중인 값과 비교해 실제로 변경했는지 판단한다.
  const originalSnapshotRef = useRef({ text: '', imageUrls: [] as string[] });

  const startEditing = useCallback(() => {
    const { text, imageUrls } = splitContentImages(comment.content);
    setEditContent(text);
    setExistingImageUrls(imageUrls);
    setIsEditing(true);
    originalSnapshotRef.current = { text, imageUrls };
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
        clearEditPastedImage(index - existingImageUrls.length);
      }
    },
    [existingImageUrls.length, clearEditPastedImage]
  );

  const handleUpdate = useCallback(() => {
    if (!editContent.trim() && editImages.length === 0 && existingImageUrls.length === 0) {
      return;
    }
    updateComment(
      {
        commentId: comment.id,
        content: editContent,
        images: editImages,
        existingImages: existingImageUrls,
      },
      {
        onSuccess: () => {
          setIsEditing(false);
          clearAllEditImages();
        },
      }
    );
  }, [comment.id, editContent, editImages, existingImageUrls, updateComment, clearAllEditImages]);

  const canSubmit =
    (editContent.trim().length > 0 || editImages.length > 0 || existingImageUrls.length > 0) &&
    !isUpdating;

  const isDirty =
    isEditing &&
    (editContent !== originalSnapshotRef.current.text ||
      editImages.length > 0 ||
      existingImageUrls.length !== originalSnapshotRef.current.imageUrls.length);

  useUnsavedChanges(`comment-update:${comment.id}`, isDirty);

  return {
    isEditing,
    editContent,
    editImagePreviewUrls,
    isEditDraggingOver,
    isUpdating,
    canSubmit,
    setEditContent,
    startEditing,
    cancelEditing,
    addEditFiles,
    handleEditPaste,
    handleEditDrop,
    handleEditDragOver,
    handleEditDragEnter,
    handleEditDragLeave,
    clearEditImage,
    handleUpdate,
  };
}
