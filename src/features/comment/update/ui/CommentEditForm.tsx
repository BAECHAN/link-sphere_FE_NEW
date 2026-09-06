import { useRef, useState } from 'react';
import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { X, Check, ImagePlus } from 'lucide-react';
import { Kbd } from '@/shared/ui/atoms/kbd';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { ImageAttachmentField } from '@/shared/ui/elements/ImageAttachmentField';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { LinkThumbnail } from '@/shared/ui/atoms/link-thumbnail';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/const';
import { Comment } from '@/entities/comment/model/comment.schema';
import { useUpdateComment } from '@/features/comment/update/hooks/useUpdateComment';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

interface CommentEditFormProps {
  comment: Comment;
  postId: string;
  onCancel: () => void;
  onSuccess: () => void;
}

export function CommentEditForm({ comment, postId, onCancel, onSuccess }: CommentEditFormProps) {
  const {
    form,
    onSubmit,
    contentValue,
    isUpdating,
    canSubmit,
    isOverLimit,
    imagePreviewUrls,
    isDraggingOver,
    addFiles,
    handlePaste,
    handleDrop,
    handleDragOver,
    handleDragEnter,
    handleDragLeave,
    clearImage,
  } = useUpdateComment({ comment, postId, onSuccess });

  const { register } = form;
  const isMobile = useIsMobile();
  const linkMetadata = comment.linkMetadata;

  const containerRef = useRef<HTMLDivElement>(null);
  const [showValidationHighlight, setShowValidationHighlight] = useState(false);

  // ⌘+Enter로 빈 상태 제출 시, 토스트만으로는 어느 폼인지 알기 어려워 그 폼 자신을 화면
  // 중앙으로 스크롤하고 잠깐 강조한다.
  function highlightEmptyForm() {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setShowValidationHighlight(true);
    setTimeout(() => setShowValidationHighlight(false), 1300);
  }

  return (
    <form onSubmit={onSubmit} className="space-y-2" noValidate>
      <div
        ref={containerRef}
        className={cn(
          'relative rounded-md transition-shadow duration-300',
          isDraggingOver && 'ring-2 ring-primary ring-offset-2'
        )}
      >
        {isDraggingOver && (
          <div
            // 점선 박스보다 상하 72px 넓게 실제 드랍 판정 영역을 확장한다(좌우는 페이지 패딩만큼만 —
            // 그 이상 넓히면 모바일에서 가로 스크롤이 생긴다). 드래그 중에만 마운트하므로 평소엔
            // 텍스트영역 클릭·포커스를 가리지 않는다.
            className="absolute -inset-x-4 -inset-y-18 z-20"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          />
        )}
        {isDraggingOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-primary bg-primary/10">
            <ImagePlus className="h-6 w-6 text-primary" />
            <span className="text-sm font-medium text-primary">{TEXTS.comment.form.dropHere}</span>
          </div>
        )}
        <Textarea
          aria-invalid={showValidationHighlight || isOverLimit}
          autoFocus
          className="min-h-[80px] text-sm"
          placeholder={TEXTS.comment.form.editPlaceholder}
          {...register('content')}
          onPaste={handlePaste}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && e.metaKey) {
              e.preventDefault();
              if (!canSubmit) {
                highlightEmptyForm();
              }
              onSubmit(e as unknown as React.FormEvent);
            }
          }}
        />
      </div>
      {isOverLimit && (
        <p className="text-xs text-destructive">{TEXTS.validation.commentContentTooLong}</p>
      )}
      {contentValue && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <p className="text-xs text-muted-foreground mb-1.5">{TEXTS.comment.form.preview}</p>
          <MarkdownContent content={contentValue} isMobile={isMobile} />
          {linkMetadata && contentValue.includes(linkMetadata.url) && (
            <a
              href={linkMetadata.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block mt-2 border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
              style={{ maxWidth: '400px' }}
            >
              <LinkThumbnail src={linkMetadata.ogImage} alt={linkMetadata.title} />
              <div className="p-2 bg-muted/30">
                <p className="text-xs font-semibold truncate">{linkMetadata.title}</p>
                {linkMetadata.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {linkMetadata.description}
                  </p>
                )}
                <p className="text-xs text-muted-foreground truncate mt-1">{linkMetadata.url}</p>
              </div>
            </a>
          )}
        </div>
      )}
      <div className="space-y-2">
        <ImageAttachmentField
          previewUrls={imagePreviewUrls}
          count={imagePreviewUrls.length}
          maxCount={MAX_COMMENT_IMAGES}
          onAttach={addFiles}
          onRemove={clearImage}
        />
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="h-8 px-2 text-xs"
          >
            <X className="mr-1 h-3 w-3" />
            {TEXTS.comment.form.cancel}
          </Button>
          <TooltipWrapper
            content={!canSubmit && !isUpdating ? TEXTS.validation.commentOrImageRequired : null}
            disabled={!canSubmit}
          >
            <Button type="submit" size="sm" disabled={!canSubmit} className="h-8 px-2 text-xs">
              <Check className="mr-1 h-3 w-3" />
              {isUpdating ? TEXTS.comment.form.saving : TEXTS.comment.form.save}
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
          </TooltipWrapper>
        </div>
      </div>
    </form>
  );
}
