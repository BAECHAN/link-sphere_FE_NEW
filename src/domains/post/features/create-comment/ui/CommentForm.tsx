import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { X } from 'lucide-react';
import { MarkdownContent } from '@/domains/post/_common/ui/MarkdownContent';
import { useCreateComment } from '@/domains/post/features/create-comment/hooks/useCreateComment';

interface CommentFormProps {
  postId: string;
  parentId?: string;
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
  const {
    form,
    onSubmit,
    isPending,
    isReply,
    contentValue,
    imagePreviewUrl,
    handlePaste,
    clearImage,
  } = useCreateComment({ postId, parentId, onSuccess, autoFocus });

  const {
    register,
    formState: { errors },
  } = form;

  return (
    <form onSubmit={onSubmit} className={`space-y-2 ${className}`}>
      <div className="relative">
        <Textarea
          placeholder={isReply ? '답글을 작성하세요...' : '댓글을 작성하세요...'}
          className="min-h-[80px] resize-none pr-20"
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
            onClick={clearImage}
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
