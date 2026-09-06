import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUpdateCommentMutation } from '@/entities/comment/api/comment.queries';
import { Comment, commentContentFormSchema } from '@/entities/comment/model/comment.schema';
import { estimateCommentPayloadBytes } from '@/entities/comment/model/estimateCommentPayloadBytes';
import {
  MAX_COMMENT_IMAGES,
  MAX_COMMENT_CONTENT_BYTES,
  MAX_COMMENT_PAYLOAD_BYTES,
} from '@/entities/comment/config/const';
import { useImageAttachments } from '@/shared/hooks/useImageAttachments';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { splitContentImages } from '@/shared/lib/content/imageContent';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';

type FormValues = { content: string };

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
    resolver: zodResolver(commentContentFormSchema),
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

  const onSubmit = form.handleSubmit(
    (data: FormValues) => {
      const content = (data.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      if (!content.trim() && editImages.length === 0 && existingImageUrls.length === 0) {
        toast.error(TEXTS.validation.commentRequired);
        return;
      }

      // content 원본 바이트만 보는 zod 체크로는 못 잡는 경우의 안전망 - 줄바꿈이 많으면
      // JSON 이스케이프로, 이미지가 많으면 URL 길이로 실제 전송량이 늘어나 WAF의 8,192바이트
      // 벽을 넘을 수 있다. 그러면 앱 에러 처리를 못 타는 403 HTML을 그대로 받는다.
      if (
        estimateCommentPayloadBytes(content, existingImageUrls, editImages.length) >
        MAX_COMMENT_PAYLOAD_BYTES
      ) {
        toast.error(TEXTS.validation.commentPayloadTooLarge);
        return;
      }

      updateComment(
        { commentId: comment.id, content, images: editImages, existingImages: existingImageUrls },
        { onSuccess: () => onSuccess?.() }
      );
    },
    () => {
      // zod가 막은 경우(길이 초과) - 없으면 제출이 아무 반응 없이 삼켜진다.
      toast.error(TEXTS.validation.commentContentTooLong);
    }
  );

  const isOverLimit = getUtf8ByteLength(contentValue) > MAX_COMMENT_CONTENT_BYTES;

  // 길이 초과는 버튼을 막지 않는다 - 비활성 버튼은 클릭 이벤트 자체가 안 먹어서 onSubmit의
  // zod 검증(→ 초과 안내 토스트)이 실행될 기회조차 없어진다. 실제 제출은 zod가 막는다.
  const canSubmit =
    (!!contentValue.trim() || editImages.length > 0 || existingImageUrls.length > 0) && !isUpdating;

  return {
    form,
    onSubmit,
    contentValue,
    isUpdating,
    canSubmit,
    isOverLimit,
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
