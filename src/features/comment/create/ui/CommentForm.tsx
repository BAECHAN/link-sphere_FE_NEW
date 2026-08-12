import { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { ImagePlus, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { ImageAttachmentField } from '@/shared/ui/elements/ImageAttachmentField';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
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

export interface CommentFormHandle {
  focus: () => void;
}

export const CommentForm = forwardRef<CommentFormHandle, CommentFormProps>(function CommentForm(
  { postId, parentId, onCancel, onSuccess, className, autoFocus },
  ref
) {
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
    clearAllImages,
  } = useCreateComment({ postId, parentId, onSuccess, autoFocus });

  const { register } = form;

  const isMobile = useIsMobile();
  const canSubmit = !!contentValue.trim() || images.length > 0;

  const containerRef = useRef<HTMLDivElement>(null);
  // 병합 콜백 ref에서 직접 .current를 대입해야 해서 MutableRefObject가 되도록
  // null을 타입에 포함시킨다(useRef<T>(null)은 readonly RefObject를 반환함).
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [showValidationHighlight, setShowValidationHighlight] = useState(false);
  // 모바일에서는 미리보기가 화면을 많이 차지해 기본 접힘 - 데스크톱은 기존처럼 항상 펼침
  const [showPreview, setShowPreview] = useState(!isMobile);

  // 부모(스크롤 이동 버튼 등)가 이 폼의 텍스트영역에 포커스를 줄 수 있도록 노출한다.
  useImperativeHandle(ref, () => ({
    focus: () => textareaRef.current?.focus({ preventScroll: true }),
  }));

  // ⌘+Enter로 빈 상태 제출 시, 토스트만으로는 어느 폼(답글창이 여러 개 열려 있을 수 있음)인지
  // 알기 어려워 그 폼 자신을 화면 중앙으로 스크롤하고 잠깐 강조한다.
  function highlightEmptyForm() {
    containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setShowValidationHighlight(true);
    setTimeout(() => setShowValidationHighlight(false), 1300);
  }

  // onCancel이 없는 최상위 작성 폼(답글처럼 닫히는 개념이 없음)에서는 취소 버튼이
  // 입력 중이던 내용을 지우는 역할을 한다.
  function handleClearDraft() {
    form.reset();
    clearAllImages();
  }

  const { ref: registerContentRef, ...contentRegister } = register('content');

  return (
    <form onSubmit={onSubmit} className={`space-y-2 ${className}`}>
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
          aria-invalid={showValidationHighlight}
          placeholder={
            isReply ? TEXTS.comment.form.replyPlaceholder : TEXTS.comment.form.commentPlaceholder
          }
          className="min-h-[80px] resize-none pr-20"
          {...contentRegister}
          ref={(el) => {
            registerContentRef(el);
            textareaRef.current = el;
          }}
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

      {contentValue && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-auto min-h-0 w-full justify-between gap-1 p-0 text-xs text-muted-foreground mb-1.5 hover:bg-transparent"
            aria-label={
              showPreview ? TEXTS.comment.form.hidePreview : TEXTS.comment.form.showPreview
            }
            onClick={() => setShowPreview((prev) => !prev)}
          >
            {TEXTS.comment.form.preview}
            {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
          {showPreview && <MarkdownContent content={contentValue} />}
        </div>
      )}

      <div className="mt-2 space-y-2">
        <ImageAttachmentField
          previewUrls={imagePreviewUrls}
          count={images.length}
          maxCount={MAX_COMMENT_IMAGES}
          onAttach={addFiles}
          onRemove={clearImage}
        />
        <div className="flex justify-end gap-2">
          {onCancel ? (
            <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
              {TEXTS.comment.form.cancel}
            </Button>
          ) : (
            canSubmit && (
              <Button type="button" variant="ghost" size="sm" onClick={handleClearDraft}>
                {TEXTS.comment.form.cancel}
              </Button>
            )
          )}
          <TooltipWrapper
            content={canSubmit ? null : TEXTS.validation.commentOrImageRequired}
            disabled={!canSubmit}
          >
            <Button type="submit" size="sm" className="gap-1.5" disabled={!canSubmit}>
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
          </TooltipWrapper>
        </div>
      </div>
    </form>
  );
});

CommentForm.displayName = 'CommentForm';
