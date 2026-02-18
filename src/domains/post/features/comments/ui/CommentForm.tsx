import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
} from '@/domains/post/_common/api/comment.queries';
import { useEffect } from 'react';

// Schema for the form, picking content only as postId/parentId are passed via props
const formSchema = z.object({
  content: z.string().min(1, '내용을 입력해주세요.'),
});

type FormValues = z.infer<typeof formSchema>;

interface CommentFormProps {
  postId: string;
  parentId?: string; // If provided, it's a reply
  onCancel?: () => void;
  onSuccess?: () => void;
  className?: string;
  autoFocus?: boolean;
}

export function CommentForm({
  postId,
  parentId,
  onCancel,
  onSuccess,
  className,
  autoFocus,
}: CommentFormProps) {
  const createCommentMutation = useCreateCommentMutation(postId);
  const createReplyMutation = useCreateReplyMutation(postId);

  const isReply = !!parentId;
  const isPending = createCommentMutation.isPending || createReplyMutation.isPending;

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
    },
  });

  useEffect(() => {
    if (autoFocus) {
      setFocus('content');
    }
  }, [autoFocus, setFocus]);

  const onSubmit = (data: FormValues) => {
    if (isReply && parentId) {
      createReplyMutation.mutate(
        { commentId: parentId, content: data.content },
        {
          onSuccess: () => {
            reset();
            onSuccess?.();
          },
        }
      );
    } else {
      createCommentMutation.mutate(
        { postId, content: data.content },
        {
          onSuccess: () => {
            reset();
            onSuccess?.();
          },
        }
      );
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className={`space-y-2 ${className}`}>
      <div className="relative">
        <Textarea
          placeholder={isReply ? '답글을 작성하세요...' : '댓글을 작성하세요...'}
          className="min-h-[80px] resize-none pr-20" // space for button if we want absolute
          {...register('content')}
          disabled={isPending}
        />
        {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            취소
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? '등록 중...' : isReply ? '답글 등록' : '댓글 등록'}
        </Button>
      </div>
    </form>
  );
}
