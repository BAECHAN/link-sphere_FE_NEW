import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { X } from 'lucide-react';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { useCreateComment } from '@/features/comment/create/hooks/useCreateComment';
import { TEXTS } from '@/shared/config/texts';

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
          placeholder={
            isReply ? TEXTS.comment.form.replyPlaceholder : TEXTS.comment.form.commentPlaceholder
          }
          className="min-h-[80px] resize-none pr-20"
          {...register('content')}
          disabled={isPending}
          onPaste={handlePaste}
        />
        {errors.content && (
          <p className="text-xs text-destructive mt-1">{errors.content.message}</p>
        )}
      </div>

      {contentValue && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1.5">{TEXTS.comment.form.preview}</p>
          <MarkdownContent content={contentValue} />
        </div>
      )}

      {imagePreviewUrl && (
        <div className="relative inline-block mt-2 border border-border rounded-md overflow-hidden group">
          <img src={imagePreviewUrl} alt="Pasted preview" className="max-h-32 object-contain" />
          <Button
            type="button"
            variant="ghost"
            onClick={clearImage}
            title={TEXTS.comment.form.removeImage}
            className={cn(
              'absolute top-1 right-1 h-auto w-auto p-1',
              'bg-black/50 text-white rounded-full',
              'opacity-0 group-hover:opacity-100 transition-opacity',
              'hover:bg-black/70'
            )}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="flex justify-end gap-2 mt-2">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={isPending}>
            {TEXTS.comment.form.cancel}
          </Button>
        )}
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending
            ? TEXTS.comment.form.submitting
            : isReply
              ? TEXTS.comment.form.submitReply
              : TEXTS.comment.form.submitComment}
        </Button>
      </div>
    </form>
  );
}
