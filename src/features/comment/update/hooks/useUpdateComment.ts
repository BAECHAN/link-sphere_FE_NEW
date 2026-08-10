import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useUpdateCommentMutation } from '@/entities/comment/api/comment.queries';
import { Comment } from '@/entities/comment/model/comment.schema';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/const';
import { useImageAttachments } from '@/shared/hooks/useImageAttachments';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { splitContentImages } from '@/shared/lib/content/imageContent';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';

const formSchema = z.object({
  content: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

interface UseUpdateCommentOptions {
  comment: Comment;
  postId: string;
  onSuccess?: () => void;
}

export function useUpdateComment({ comment, postId, onSuccess }: UseUpdateCommentOptions) {
  const { mutate: updateComment, isPending: isUpdating } = useUpdateCommentMutation(postId);

  // 편집 세션은 컴포넌트 마운트~언마운트 동안만 유지되므로, 시작 시점 스냅샷은 한 번만 계산한다.
  const [initialSnapshot] = useState(() => splitContentImages(comment.content));
  const [existingImageUrls, setExistingImageUrls] = useState(initialSnapshot.imageUrls);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: initialSnapshot.text },
  });

  const { watch, formState } = form;
  const contentValue = watch('content');

  const {
    images: editImages,
    imagePreviewUrls: pastedPreviewUrls,
    isDraggingOver,
    addFiles,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage: clearPastedImage,
  } = useImageAttachments({
    maxCount: MAX_COMMENT_IMAGES,
    reservedCount: existingImageUrls.length,
  });

  const imagePreviewUrls = [...existingImageUrls, ...pastedPreviewUrls];

  const clearImage = (index: number) => {
    if (index < existingImageUrls.length) {
      setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      clearPastedImage(index - existingImageUrls.length);
    }
  };

  const isDirty =
    formState.isDirty ||
    editImages.length > 0 ||
    existingImageUrls.length !== initialSnapshot.imageUrls.length;

  useUnsavedChanges(`comment-update:${comment.id}`, isDirty);

  const onSubmit = form.handleSubmit((data: FormValues) => {
    const content = (data.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (!content.trim() && editImages.length === 0 && existingImageUrls.length === 0) {
      toast.error(TEXTS.validation.commentRequired);
      return;
    }

    updateComment(
      { commentId: comment.id, content, images: editImages, existingImages: existingImageUrls },
      { onSuccess: () => onSuccess?.() }
    );
  });

  const canSubmit =
    (!!contentValue.trim() || editImages.length > 0 || existingImageUrls.length > 0) && !isUpdating;

  return {
    form,
    onSubmit,
    contentValue,
    isUpdating,
    canSubmit,
    imagePreviewUrls,
    isDraggingOver,
    addFiles,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage,
  };
}
