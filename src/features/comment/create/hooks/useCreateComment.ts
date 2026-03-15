import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
} from '@/entities/comment/api/comment.queries';
import { useImagePaste } from '@/shared/hooks/useImagePaste';

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

  const { mutateAsync: createComment, isPending: isCreatingComment } =
    useCreateCommentMutation(postId);
  const { mutateAsync: createReply, isPending: isCreatingReply } = useCreateReplyMutation(postId);

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

  useEffect(() => {
    if (autoFocus) {
      setFocus('content');
    }
  }, [autoFocus, setFocus]);

  const onSubmit = form.handleSubmit((data: FormValues) => {
    const content = (data.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    if (!content.trim() && pastedImages.length === 0) {
      setError('content', { type: 'manual', message: '내용 또는 이미지를 추가해주세요.' });
      return;
    }

    const handleSuccess = () => {
      reset();
      clearAllImages();
      onSuccess?.();
    };

    if (isReply && parentId) {
      createReply(
        { commentId: parentId, content, images: pastedImages },
        { onSuccess: handleSuccess }
      );
    } else {
      createComment({ content, images: pastedImages }, { onSuccess: handleSuccess });
    }
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
