import { useEffect, useId, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
} from '@/entities/comment/api/comment.queries';
import { Comment, commentContentFormSchema } from '@/entities/comment/model/comment.schema';
import { CommentUtil } from '@/entities/comment/utils/comment.util';
import {
  MAX_COMMENT_CONTENT_BYTES,
  MAX_COMMENT_PAYLOAD_BYTES,
} from '@/entities/comment/config/comment.const';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/comment.contract';
import { useImageAttachments } from '@/shared/hooks/useImageAttachments';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { useHasLeftPage } from '@/shared/hooks/useHasLeftPage';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { useSignedOutNotice } from '@/entities/auth/hooks/useSignedOutNotice';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { TEXTS } from '@/shared/config/texts';
import { toast } from '@/shared/lib/toast/toast';
import { showLeftPageFailureToast } from '@/shared/lib/toast/LeftPageFailureToast';
import { ErrorUtil } from '@/shared/utils/error.util';

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

  const { reset, setFocus, subscribe, getValues, control } = form;
  const contentValue = useWatch({ control, name: 'content' });

  // 등록 실패 원인 안내 - 버튼 위 FormAlert에 남고, 입력·첨부를 고치거나 다시 제출하면 지운다
  const [failureMessage, setFailureMessage] = useState<string | null>(null);

  // 요청이 도는 사이 폼이 닫히거나(답글 취소·모바일 바 접기 등) 다른 화면으로 떠나면 안내를 띄울 자리가 없다 -
  // 그때만 토스트로 대신 알린다. 떠나는 중 다음 화면을 불러오는 동안엔 폼이 아직 마운트돼 있어 경로까지 본다
  const hasLeftPage = useHasLeftPage();

  useEffect(
    function clearFailureOnEdit() {
      // watch(콜백) 대신 subscribe를 쓴다 - useCreatePost.ts의 clearSubmitErrorsOnEdit 주석 참고
      return subscribe({ formState: { values: true }, callback: () => setFailureMessage(null) });
    },
    [subscribe]
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
    // 첨부를 바꾸면 이전 실패 안내를 지운다 - 파일이 검증에 걸려 들어가지 않았으면 고친 게 없으니 남긴다
    onFilesAdded: () => setFailureMessage(null),
  });

  // 이미지를 빼도 이전 실패 안내를 지운다(넣는 쪽은 위 onFilesAdded)
  function clearingFailure<Args extends unknown[], Result>(handler: (...args: Args) => Result) {
    return (...args: Args): Result => {
      setFailureMessage(null);
      return handler(...args);
    };
  }

  const isOverLimit = getUtf8ByteLength(contentValue) > MAX_COMMENT_CONTENT_BYTES;
  // 입력칸 아래 글자 수 - 상한을 넘는 시점은 isOverLimit과 같다(comment.const.ts의 MAX_COMMENT_CONTENT_HANGUL_CHARS 주석).
  // id는 입력칸 aria-describedby용이다(https://react.dev/reference/react/useId)
  const contentLength = CommentUtil.countHangulEquivalentChars(contentValue);
  const contentCountId = useId();

  const hasInput = contentValue.trim().length > 0 || images.length > 0;

  const unsavedChangesKey = `comment-create:${postId}:${parentId ?? 'root'}`;

  useUnsavedChanges(unsavedChangesKey, hasInput);
  const signedOutNotice = useSignedOutNotice(hasInput);

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
      // 요청하는 사이 로그인이 만료됐다(ErrorUtil.isSessionExpired) - 풀린 뒤에 누르면 가드가 먼저 막아 여기 오지 않는다.
      // 다시 로그인하라는 안내는 로그인 창이, 폼 안 안내는 useSignedOutNotice가 맡는다(되돌린 입력이 있는 동안).
      // 여기서는 비웠던 입력만 되돌린다. 폼이 닫혔으면 조용히 끝낸다
      const mode = isReply ? 'reply' : 'create';
      const message = ErrorUtil.isSessionExpired(error)
        ? null
        : CommentUtil.resolveSubmitError(error, mode);

      // 제출 때 입력을 비워 떠난 화면에는 실패 흔적이 남지 않는다 - 닫을 때까지 남는 토스트가 유일한 안내다
      if (hasLeftPage()) {
        if (message) {
          showLeftPageFailureToast({
            key: unsavedChangesKey,
            title: ErrorUtil.resolveFailureMessage(
              error,
              isReply
                ? TEXTS.messages.error.leftPageFailure.replyCreateTitle
                : TEXTS.messages.error.leftPageFailure.commentCreateTitle,
              TEXTS.messages.error.leftPageFailure.outcomeUnknownTitle
            ),
            description: CommentUtil.toLeftFormFailureDescription(message, mode),
          });
        }

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
    contentLength,
    contentCountId,
    // 로그인이 풀린 채 남아 있으면 그 안내가 먼저다(useCreatePost.ts와 같은 이유)
    failureMessage: signedOutNotice ?? failureMessage,
    images,
    imagePreviewUrls,
    isDraggingOver,
    addFiles,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage: clearingFailure(clearImage),
    clearAllImages,
  };
}
