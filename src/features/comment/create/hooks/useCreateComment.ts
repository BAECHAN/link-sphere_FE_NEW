import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
} from '@/entities/comment/api/comment.queries';
import { Comment, commentContentFormSchema } from '@/entities/comment/model/comment.schema';
import { CommentUtil } from '@/entities/comment/utils/comment.util';
import {
  MAX_COMMENT_IMAGES,
  MAX_COMMENT_CONTENT_BYTES,
  MAX_COMMENT_PAYLOAD_BYTES,
} from '@/entities/comment/config/comment.const';
import { useImageAttachments } from '@/shared/hooks/useImageAttachments';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';

type FormValues = { content: string };

interface UseCreateCommentOptions {
  postId: string;
  parentId?: string;
  onSuccess?: () => void;
  autoFocus?: boolean;
}

function getCommentSubmitError(
  content: string,
  imagesCount: number,
  isReply: boolean
): string | null {
  if (!content.trim() && imagesCount === 0) {
    return isReply ? TEXTS.validation.replyRequired : TEXTS.validation.commentRequired;
  }

  // content 원본 바이트만 보는 zod 체크로는 못 잡는 경우의 안전망 - 줄바꿈이 많으면
  // JSON 이스케이프로, 이미지가 많으면 URL 길이로 실제 전송량이 늘어나 WAF의 8,192바이트
  // 벽을 넘을 수 있다. 그러면 앱 에러 처리를 못 타는 403 HTML을 그대로 받는다.
  if (
    CommentUtil.estimateCommentPayloadBytes(content, [], imagesCount) > MAX_COMMENT_PAYLOAD_BYTES
  ) {
    return TEXTS.validation.commentPayloadTooLarge;
  }

  return null;
}

export function useCreateComment({
  postId,
  parentId,
  onSuccess,
  autoFocus,
}: UseCreateCommentOptions) {
  const isReply = !!parentId;

  const { mutateAsync: createComment } = useCreateCommentMutation(postId);
  const { mutateAsync: createReply } = useCreateReplyMutation(postId);
  const guard = useAuthGuard();
  const { account } = useAccount();

  const form = useForm<FormValues>({
    resolver: zodResolver(commentContentFormSchema),
    defaultValues: { content: '' },
  });

  const { reset, setFocus, watch, getValues } = form;
  const contentValue = watch('content');

  // 등록 실패 원인 안내 - 버튼 위 FormAlert에 남고, 입력·첨부를 고치거나 다시 제출하면 지운다
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  // 요청이 도는 사이 폼이 닫히면(답글 취소·모바일 바 접기 등) 안내를 띄울 자리가 없다 - 그때만
  // 토스트로 대신 알린다
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

  // 첨부를 바꾸면 이전 실패 안내를 지운다. useImageAttachments의 onImageSet은 실패 뒤 이미지를
  // 되돌릴 때도 불려 방금 남긴 안내까지 지우므로, 사용자가 직접 부르는 첨부 핸들러만 감싼다.
  function clearingFailure<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
    return (...args: Args): Result => {
      setFailureMessage(null);
      return handler(...args);
    };
  }

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

  // mutate 콜백 대신 mutateAsync를 기다린다 - mutate 콜백은 요청 도중 폼이 언마운트되면 호출되지
  // 않는데, 전역 토스트를 꺼둔(manualErrorHandling) 지금은 그러면 실패가 조용히 묻힌다.
  async function submitComment({
    content,
    submittedImages,
    author,
  }: {
    content: string;
    submittedImages: File[];
    author: Comment['author'];
  }) {
    try {
      if (isReply && parentId) {
        await createReply({ commentId: parentId, content, images: submittedImages, author });
      } else {
        await createComment({ content, images: submittedImages, author });
      }
    } catch (error) {
      const message = CommentUtil.resolveSubmitError(error, isReply ? 'reply' : 'create');

      if (!isMountedRef.current) {
        toast.error(message);
        return;
      }

      // 요청이 도는 사이 사용자가 새 댓글을 쓰기 시작했다면 덮어쓰지 않는다.
      if (!getValues('content').trim()) {
        reset({ content });
      }

      setImages((prev) => (prev.length > 0 ? prev : submittedImages));
      // 위 reset이 입력 변경 구독(clearFailureOnEdit)을 거쳐 안내를 지우므로 그 뒤에 남긴다
      setFailureMessage(message);
      return;
    }

    onSuccess?.();
  }

  const onSubmit = form.handleSubmit(
    (data: FormValues) => {
      guard(() => {
        if (!account) {
          return;
        }

        // BE도 같은 검사를 403 EMAIL_NOT_VERIFIED로 거절하지만(방어 계층 중복), 클릭
        // 가능한 채로 두고 안내만 보여준다(disabled 대신 - 아래 getCommentSubmitError와
        // 같은 방식).
        if (account.emailVerified === false) {
          toast.error(TEXTS.messages.error.emailVerificationRequired);
          return;
        }

        const content = (data.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

        const submitError = getCommentSubmitError(content, images.length, isReply);

        if (submitError) {
          toast.error(submitError);
          return;
        }

        const author = { id: account.id, nickname: account.nickname, image: account.image ?? null };

        // 서버 응답을 기다리지 않고 즉시 폼을 비운다 - 낙관적 업데이트가 목록에 바로 반영하므로
        // 여기서 기다릴 이유가 없다. 단 "폼을 닫는" onSuccess는 성공한 뒤로 미룬다 - 지금 닫으면
        // (답글 폼·모바일 바는 onSuccess에서 컴포넌트를 언마운트한다) 실패했을 때 입력을 되돌리고
        // 원인을 안내할 자리가 사라진다.
        setFailureMessage(null);
        reset();
        clearAllImages();

        void submitComment({ content, submittedImages: images, author });
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
    failureMessage,
    images,
    imagePreviewUrls,
    isDraggingOver,
    addFiles: clearingFailure(addFiles),
    handlePaste: clearingFailure(handlePaste),
    handleDrop: clearingFailure(handleDrop),
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage: clearingFailure(clearImage),
    clearAllImages,
  };
}
