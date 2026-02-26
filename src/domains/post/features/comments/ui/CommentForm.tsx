import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
} from '@/domains/post/_common/api/comment.queries';
import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { MarkdownContent } from '@/domains/post/features/comments/ui/MarkdownContent';

// Schema for the form, picking content only as postId/parentId are passed via props
const formSchema = z.object({
  content: z.string(),
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

  const [pastedImage, setPastedImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setFocus,
    setError,
    clearErrors,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      content: '',
    },
  });

  const contentValue = watch('content');

  useEffect(() => {
    if (pastedImage) {
      clearErrors('content');
      const url = URL.createObjectURL(pastedImage);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setImagePreviewUrl(null);
    }
  }, [pastedImage, clearErrors]);

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setPastedImage(file);
          // 이미지를 텍스트 영역에 문자열로 붙여넣는 것을 방지
          e.preventDefault();
          break; // 단일 이미지 업로드만 지원
        }
      }
    }
  };

  useEffect(() => {
    if (autoFocus) {
      setFocus('content');
    }
  }, [autoFocus, setFocus]);

  const onSubmit = (data: FormValues) => {
    // 개행 유지: CRLF/CR을 LF로 통일해 서버 전송 시 개행이 보존되도록 함
    const content = (data.content || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    if (!content.trim() && !pastedImage) {
      setError('content', { type: 'manual', message: '내용 또는 이미지를 추가해주세요.' });
      return;
    }

    if (isReply && parentId) {
      createReplyMutation.mutate(
        { commentId: parentId, content, image: pastedImage },
        {
          onSuccess: () => {
            reset();
            setPastedImage(null);
            onSuccess?.();
          },
        }
      );
    } else {
      createCommentMutation.mutate(
        { content, image: pastedImage },
        {
          onSuccess: () => {
            reset();
            setPastedImage(null);
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
          onPaste={handlePaste}
        />
        {errors.content && <p className="text-xs text-red-500 mt-1">{errors.content.message}</p>}
      </div>

      {contentValue && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1.5">미리보기</p>
          <MarkdownContent content={contentValue} />
        </div>
      )}

      {imagePreviewUrl && (
        <div className="relative inline-block mt-2 border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden group">
          <img src={imagePreviewUrl} alt="Pasted preview" className="max-h-32 object-contain" />
          <button
            type="button"
            onClick={() => setPastedImage(null)}
            className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
            title="이미지 삭제"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      <div className="flex justify-end gap-2 mt-2">
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
