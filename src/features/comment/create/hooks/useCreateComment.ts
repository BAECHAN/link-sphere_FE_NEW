import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
} from '@/entities/comment/api/comment.queries';
import { commentContentFormSchema } from '@/entities/comment/model/comment.schema';
import { estimateCommentPayloadBytes } from '@/entities/comment/model/estimateCommentPayloadBytes';
import {
  MAX_COMMENT_IMAGES,
  MAX_COMMENT_CONTENT_BYTES,
  MAX_COMMENT_PAYLOAD_BYTES,
} from '@/entities/comment/config/const';
import { useImageAttachments } from '@/shared/hooks/useImageAttachments';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { useAuthGuard } from '@/entities/user/model/useAuthGuard';
import { useAccount } from '@/entities/user/model/useAccount';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';

type FormValues = { content: string };

interface UseCreateCommentOptions {
  postId: string;
  parentId?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
}

export function useCreateComment({
  postId,
  parentId,
  onSuccess,
  autoFocus,
}: UseCreateCommentOptions) {
  const isReply = !!parentId;

  const { mutate: createComment } = useCreateCommentMutation(postId);
  const { mutate: createReply } = useCreateReplyMutation(postId);
  const guard = useAuthGuard();
  const { account } = useAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(commentContentFormSchema),
    defaultValues: { content: '' },
  });

  const { reset, setFocus, watch, getValues } = form;
  const contentValue = watch('content');

  const {
    images,
    setImages,
    imagePreviewUrls,
    isDraggingOver,
    addFiles,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage,
    clearAllImages,
  } = useImageAttachments({
    maxCount: MAX_COMMENT_IMAGES,
  });

  const isOverLimit = getUtf8ByteLength(contentValue) > MAX_COMMENT_CONTENT_BYTES;

  useUnsavedChanges(
    `comment-create:${postId}:${parentId ?? 'root'}`,
    contentValue.trim().length > 0 || images.length > 0
  );

  useEffect(() => {
    if (autoFocus) {
      setFocus('content');
    }
  }, [autoFocus, setFocus]);

  const onSubmit = form.handleSubmit(
    (data: FormValues) => {
      guard(() => {
        if (!account) {
          return;
        }

        const content = (data.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        if (!content.trim() && images.length === 0) {
          toast.error(isReply ? TEXTS.validation.replyRequired : TEXTS.validation.commentRequired);
          return;
        }

        // content 원본 바이트만 보는 zod 체크로는 못 잡는 경우의 안전망 - 줄바꿈이 많으면
        // JSON 이스케이프로, 이미지가 많으면 URL 길이로 실제 전송량이 늘어나 WAF의 8,192바이트
        // 벽을 넘을 수 있다. 그러면 앱 에러 처리를 못 타는 403 HTML을 그대로 받는다.
        if (estimateCommentPayloadBytes(content, [], images.length) > MAX_COMMENT_PAYLOAD_BYTES) {
          toast.error(TEXTS.validation.commentPayloadTooLarge);
          return;
        }

        const author = { id: account.id, nickname: account.nickname, image: account.image ?? null };
        const submittedImages = images;

        // 서버 응답을 기다리지 않고 즉시 폼을 비운다 - 낙관적 업데이트가 목록에 바로 반영하므로
        // 여기서 기다릴 이유가 없다. 단 "폼을 닫는" onSuccess는 mutate 콜백으로 미룬다 - 지금
        // 닫으면(답글 폼·모바일 바는 onSuccess에서 컴포넌트를 언마운트한다) React Query가
        // mutate 스코프 콜백을 요청이 끝나기 전 언마운트 시 호출하지 않아, 실패한 입력을
        // 되돌릴 수단이 사라진다.
        reset();
        clearAllImages();

        const callbacks = {
          onSuccess: () => onSuccess?.(),
          onError: () => {
            // 요청이 도는 사이 사용자가 새 댓글을 쓰기 시작했다면 덮어쓰지 않는다.
            if (!getValues('content').trim()) {
              reset({ content });
            }
            setImages((prev) => (prev.length > 0 ? prev : submittedImages));
            // 토스트는 띄우지 않는다 - MutationCache.onError(queryClient.ts)가 이미 소유한다.
          },
        };

        if (isReply && parentId) {
          createReply({ commentId: parentId, content, images: submittedImages, author }, callbacks);
        } else {
          createComment({ content, images: submittedImages, author }, callbacks);
        }
      });
    },
    () => {
      // zod가 막은 경우(길이 초과) - 없으면 제출이 아무 반응 없이 삼켜진다.
      toast.error(TEXTS.validation.commentContentTooLong);
    }
  );

  return {
    form,
    onSubmit,
    isReply,
    contentValue,
    isOverLimit,
    images,
    imagePreviewUrls,
    isDraggingOver,
    addFiles,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage,
    clearAllImages,
  };
}
