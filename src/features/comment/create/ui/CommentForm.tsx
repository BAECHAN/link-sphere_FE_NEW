import { ImagePlus } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { ImageAttachmentField } from '@/shared/ui/elements/ImageAttachmentField';
import { useCreateComment } from '@/features/comment/create/hooks/useCreateComment';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/const';
import { TEXTS } from '@/shared/config/texts';
import { Kbd } from '@/shared/ui/atoms/kbd';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

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
    isReply,
    contentValue,
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
  } = useCreateComment({ postId, parentId, onSuccess, autoFocus });

  const {
    register,
    formState: { errors },
  } = form;

  const isMobile = useIsMobile();

  return (
    <form onSubmit={onSubmit} className={`space-y-2 ${className}`}>
      <div
        className={cn(
          'relative rounded-md transition-colors',
          isDraggingOver && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        <div
          // 점선 박스보다 사방 72px 넓게 실제 드랍 판정 영역을 확장한다. 드래그 중에만
          // pointer-events를 켜서 평소엔 텍스트영역 클릭·포커스를 가리지 않는다. position이 없는
          // 형제(미리보기 박스·버튼 줄)는 z-index와 무관하게 항상 더 아래 페인트 레이어에 그려지므로,
          // DOM 순서상 이 레이어보다 나중에 오더라도 이벤트를 가로채지 못한다.
          className={cn(
            'absolute -inset-18 z-20',
            isDraggingOver ? 'pointer-events-auto' : 'pointer-events-none'
          )}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
        />
        {isDraggingOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-primary bg-primary/10">
            <ImagePlus className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-primary">{TEXTS.comment.form.dropHere}</span>
          </div>
        )}
        <Textarea
          placeholder={
            isReply ? TEXTS.comment.form.replyPlaceholder : TEXTS.comment.form.commentPlaceholder
          }
          className="min-h-[80px] resize-none pr-20"
          {...register('content')}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) {
              e.preventDefault();
              onSubmit(e as unknown as React.FormEvent);
            }
          }}
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

      <div className="flex items-center justify-between gap-2 mt-2">
        <ImageAttachmentField
          previewUrls={imagePreviewUrls}
          count={images.length}
          maxCount={MAX_COMMENT_IMAGES}
          onAttach={addFiles}
          onRemove={clearImage}
        />
        <div className="flex gap-2">
          {onCancel && (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {TEXTS.comment.form.cancel}
            </Button>
          )}
          <Button type="submit" size="sm" className="gap-1.5">
            {isReply ? TEXTS.comment.form.submitReply : TEXTS.comment.form.submitComment}
            {!isMobile && (
              <Kbd
                className="font-sans"
                style={{
                  backgroundColor: 'var(--kbd-in-primary-bg)',
                  color: 'var(--kbd-in-primary-color)',
                }}
              >
                ⌘ + Enter
              </Kbd>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
