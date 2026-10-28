import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useSignedOutNotice } from '@/entities/auth/hooks/useSignedOutNotice';
import { useUpdateCommentMutation } from '@/entities/comment/api/comment.queries';
import { Comment, commentContentFormSchema } from '@/entities/comment/model/comment.schema';
import { CommentUtil } from '@/entities/comment/utils/comment.util';
import {
  MAX_COMMENT_IMAGES,
  MAX_COMMENT_CONTENT_BYTES,
  MAX_COMMENT_PAYLOAD_BYTES,
} from '@/entities/comment/config/comment.const';
import { useImageAttachments } from '@/shared/hooks/useImageAttachments';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { splitContentImages } from '@/shared/lib/content/imageContent';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { ErrorUtil } from '@/shared/utils/error.util';

type FormValues = { content: string };

interface UseUpdateCommentOptions {
  comment: Comment;
  postId: string;
  onSuccess?: () => void;
}

function getCommentUpdateSubmitError(
  content: string,
  editImages: File[],
  existingImageUrls: string[]
): string | null {
  if (!content.trim() && editImages.length === 0 && existingImageUrls.length === 0) {
    return TEXTS.validation.commentRequired;
  }

  // content 원본 바이트만 보는 zod 체크로는 못 잡는 경우의 안전망 - 줄바꿈이 많으면
  // JSON 이스케이프로, 이미지가 많으면 URL 길이로 실제 전송량이 늘어나 WAF의 8,192바이트
  // 벽을 넘을 수 있다. 그러면 앱 에러 처리를 못 타는 403 HTML을 그대로 받는다.
  if (
    CommentUtil.estimateCommentPayloadBytes(content, existingImageUrls, editImages.length) >
    MAX_COMMENT_PAYLOAD_BYTES
  ) {
    return TEXTS.validation.commentPayloadTooLarge;
  }

  return null;
}

export function useUpdateComment({ comment, postId, onSuccess }: UseUpdateCommentOptions) {
  const { mutateAsync: updateComment, isPending: isUpdating } = useUpdateCommentMutation(postId);
  const guard = useAuthGuard();

  // 편집 세션은 컴포넌트 마운트~언마운트 동안만 유지되므로, 시작 시점 스냅샷은 한 번만 계산한다.
  const [initialSnapshot] = useState(() => splitContentImages(comment.content));
  const [existingImageUrls, setExistingImageUrls] = useState(initialSnapshot.imageUrls);

  const form = useForm<FormValues>({
    resolver: zodResolver(commentContentFormSchema),
    defaultValues: { content: initialSnapshot.text },
  });

  const { watch, formState } = form;
  const contentValue = watch('content');

  // 수정 실패 원인 안내 - 버튼 위 FormAlert에 남고, 입력·첨부를 고치거나 다시 제출하면 지운다
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  // 요청이 도는 사이 수정 폼을 닫으면 안내를 띄울 자리가 없다 - 그때만 토스트로 대신 알린다
  const isMountedRef = useRef(false);

  useEffect(function trackMounted() {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(
    function clearFailureOnEdit() {
      const subscription = watch(() => setFailureMessage(null));

      return () => subscription.unsubscribe();
    },
    [watch]
  );

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

  // 첨부를 바꾸면 이전 실패 안내를 지운다. useImageAttachments의 onImageSet은 실패 뒤 이미지를
  // 되돌릴 때도 불려 방금 남긴 안내까지 지우므로, 사용자가 직접 부르는 첨부 핸들러만 감싼다.
  function clearingFailure<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
    return (...args: Args): Result => {
      setFailureMessage(null);
      return handler(...args);
    };
  }

  const imagePreviewUrls = [...existingImageUrls, ...pastedPreviewUrls];

  const clearImage = clearingFailure((index: number) => {
    if (index < existingImageUrls.length) {
      setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
    } else {
      clearPastedImage(index - existingImageUrls.length);
    }
  });

  const isDirty =
    formState.isDirty ||
    editImages.length > 0 ||
    existingImageUrls.length !== initialSnapshot.imageUrls.length;

  useUnsavedChanges(`comment-update:${comment.id}`, isDirty);
  const signedOutNotice = useSignedOutNotice(isDirty);

  async function submitUpdate(data: FormValues) {
    const content = (data.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    const submitError = getCommentUpdateSubmitError(content, editImages, existingImageUrls);

    if (submitError) {
      toast.error(submitError);
      return;
    }

    setFailureMessage(null);

    // mutate 콜백 대신 mutateAsync를 기다린다 - mutate 콜백은 요청 도중 폼이 언마운트되면 호출되지
    // 않는데, 전역 토스트를 꺼둔(manualErrorHandling) 지금은 그러면 실패가 조용히 묻힌다.
    try {
      await updateComment({
        commentId: comment.id,
        content,
        images: editImages,
        existingImages: existingImageUrls,
      });
    } catch (error) {
      // 요청하는 사이 로그인이 만료됐다(ErrorUtil.isSessionExpired) - 풀린 뒤에 누르면 가드가 먼저 막아 여기 오지 않는다.
      // 다시 로그인하라는 안내는 로그인 창이, 폼 안 안내는 useSignedOutNotice가 맡는다. 고친 내용은 그대로 남는다
      if (ErrorUtil.isSessionExpired(error)) {
        return;
      }

      const message = CommentUtil.resolveSubmitError(error, 'update');

      if (isMountedRef.current) {
        setFailureMessage(message);
      } else {
        toast.error(message);
      }

      return;
    }

    onSuccess?.();
  }

  // useCreatePost.ts와 같은 이유 - 로그인이 풀린 채 눌렀으면 보내지 않고 로그인 창을 연다
  const onSubmit = form.handleSubmit(
    async (data: FormValues) => {
      let submitting: Promise<void> | undefined;

      guard(() => {
        submitting = submitUpdate(data);
      });

      await submitting;
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
    // 로그인이 풀린 채 남아 있으면 그 안내가 먼저다(useCreatePost.ts와 같은 이유)
    failureMessage: signedOutNotice ?? failureMessage,
    imagePreviewUrls,
    isDraggingOver,
    addFiles: clearingFailure(addFiles),
    handlePaste: clearingFailure(handlePaste),
    handleDrop: clearingFailure(handleDrop),
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage,
  };
}
