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
    imagePreviewUrls,
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

      {imagePreviewUrls.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {imagePreviewUrls.map((url, index) => (
            <div
              key={url}
              className="relative inline-block border border-border rounded-md overflow-visible"
            >
              <img
                src={url}
                alt={`Pasted preview ${index + 1}`}
                className="max-h-32 object-contain rounded-md"
              />
              <button
                type="button"
                onClick={() => clearImage(index)}
                title={TEXTS.comment.form.removeImage}
                className={cn(
                  'absolute -top-2 -right-2 h-5 w-5 rounded-full',
                  'bg-black border border-black shadow-sm',
                  'text-white hover:bg-zinc-700 hover:scale-110',
                  'flex items-center justify-center transition-all duration-150 cursor-pointer'
                )}
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>
          ))}
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
