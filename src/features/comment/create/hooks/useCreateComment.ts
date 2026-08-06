import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
} from '@/entities/comment/api/comment.queries';
import { useImagePaste } from '@/shared/hooks/useImagePaste';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { useAuthGuard } from '@/entities/user/hooks/useAuthGuard';
import { useAccount } from '@/entities/user/hooks/useAccount';
import { TEXTS } from '@/shared/config/texts';

const formSchema = z.object({
  content: z.string(),
});

type FormValues = z.infer<typeof formSchema>;

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

  const { mutate: createComment, isPending: isCreatingComment } = useCreateCommentMutation(postId);
  const { mutate: createReply, isPending: isCreatingReply } = useCreateReplyMutation(postId);
  const guard = useAuthGuard();
  const { account } = useAccount();

  const isPending = isCreatingComment || isCreatingReply;

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { content: '' },
  });

  const { reset, setFocus, setError, clearErrors, watch } = form;
  const contentValue = watch('content');

  const { pastedImages, imagePreviewUrls, handlePaste, clearImage, clearAllImages } = useImagePaste(
    {
      onImageSet: () => clearErrors('content'),
    }
  );

  useUnsavedChanges(
    `comment-create:${postId}:${parentId ?? 'root'}`,
    contentValue.trim().length > 0 || pastedImages.length > 0
  );

  useEffect(() => {
    if (autoFocus) {
      setFocus('content');
    }
  }, [autoFocus, setFocus]);

  const onSubmit = form.handleSubmit((data: FormValues) => {
    guard(() => {
      if (!account) {
        return;
      }

      const content = (data.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

      if (!content.trim() && pastedImages.length === 0) {
        setError('content', { type: 'manual', message: TEXTS.validation.commentOrImageRequired });
        return;
      }

      const author = { id: account.id, nickname: account.nickname, image: account.image ?? null };
      const images = pastedImages;

      // 서버 응답을 기다리지 않고 즉시 폼을 비운다 - 낙관적 업데이트가 목록에 바로 반영하므로
      // 여기서 기다릴 이유가 없다 (mutation 실패 시 목록 쪽에서 롤백된다).
      reset();
      clearAllImages();
      onSuccess?.();

      if (isReply && parentId) {
        createReply({ commentId: parentId, content, images, author });
      } else {
        createComment({ content, images, author });
      }
    });
  });

  return {
    form,
    onSubmit,
    isPending,
    isReply,
    contentValue,
    pastedImages,
    imagePreviewUrls,
    handlePaste,
    clearImage,
    clearAllImages,
  };
}
