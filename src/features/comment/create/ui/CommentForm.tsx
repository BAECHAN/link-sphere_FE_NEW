import { forwardRef, useImperativeHandle, useRef, useState, type ForwardedRef } from 'react';
import { ChevronDown, ChevronUp, Link2 } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { ImageAttachmentButton } from '@/shared/ui/elements/ImageAttachmentButton';
import { ImageAttachmentPreviews } from '@/shared/ui/elements/ImageAttachmentPreviews';
import { FormAlert } from '@/shared/ui/elements/FormAlert';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { DropTargetOverlay } from '@/shared/ui/elements/DropTargetOverlay';
import { ToggleButton } from '@/shared/ui/elements/ToggleButton';
import { CharacterCount } from '@/shared/ui/elements/CharacterCount';
import { useCreateComment } from '@/features/comment/create/hooks/useCreateComment';
import { useCopiedPostLinkSuggestion } from '@/features/comment/create/hooks/useCopiedPostLinkSuggestion';
import { MAX_COMMENT_IMAGES } from '@/entities/comment/config/comment.contract';
import { MAX_COMMENT_CONTENT_HANGUL_CHARS } from '@/entities/comment/config/comment.const';
import { TEXTS } from '@/shared/config/texts';
import { Kbd } from '@/shared/ui/atoms/kbd';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { ScrollUtil } from '@/shared/utils/scroll.util';
import { PlatformUtil } from '@/shared/utils/platform.util';

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

interface CommentFormViewProps {
  /** 댓글을 쓰는 글 - 복사한 글 링크 제안이 이 글 자신의 링크를 거른다 */
  postId: string;
  /** useCreateComment가 돌려준 값 - 폼 상태의 주인(CommentForm 또는 CommentComposer)이 넘긴다 */
  draft: ReturnType<typeof useCreateComment>;
  onCancel?: () => void;
  className?: string;
}

/**
 * 댓글 작성 폼의 화면. 상태는 갖지 않고 받은 것만 그린다 - 폭에 따라 자리가 바뀌는 최상위 작성 폼은 상태를
 * 바깥(CommentComposer)에 둬야 자리가 바뀌어도 쓰던 글이 남는다(docs/COMMENT.md §5).
 */
export const CommentFormView = forwardRef(function CommentFormView(
  { postId, draft, onCancel, className }: CommentFormViewProps,
  ref: ForwardedRef<CommentFormHandle>
) {
  const {
    form,
    onSubmit,
    isReply,
    contentValue,
    isOverLimit,
    contentLength,
    contentCountId,
    failureMessage,
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
  } = draft;
  const {
    suggestedLink,
    handleContentFocus,
    handleContentInput,
    handleSuggestionAreaBlur,
    insertSuggestedLink,
  } = useCopiedPostLinkSuggestion({ postId, form, contentValue });

  const { register } = form;

  const isMobile = useIsMobile();
  // 길이 초과는 버튼을 막지 않는다 - 비활성 버튼은 클릭 이벤트 자체가 안 먹어서
  // onSubmit의 zod 검증(→ 초과 안내 토스트)이 실행될 기회조차 없어진다. 대신 아래
  // 인라인 안내 문구로 항상 보이게 하고, 실제 제출은 zod가 막는다.
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

  // ⌘/Ctrl+Enter로 빈 상태 제출 시, 토스트만으로는 어느 폼(답글창이 여러 개 열려 있을 수 있음)인지
  // 알기 어려워 그 폼 자신을 화면 중앙으로 스크롤하고 잠깐 강조한다.
  function highlightEmptyForm() {
    containerRef.current?.scrollIntoView({ behavior: ScrollUtil.getBehavior(), block: 'center' });
    setShowValidationHighlight(true);
    setTimeout(() => setShowValidationHighlight(false), 1300);
  }

  // 한글 등 IME 조합 중에 ⌘/Ctrl+Enter가 오면 조합이 끝난 뒤(onCompositionEnd)에 제출한다. 조합 중에 제출해 입력란을
  // 비우면 브라우저가 뒤이어 확정하는 마지막 글자가 빈 입력란에 다시 들어간다(docs/COMMENT.md §10).
  // 화면에 그리지 않는 값이라 ref로 둔다(https://react.dev/reference/react/useRef)
  const submitAfterCompositionRef = useRef(false);

  function submitByShortcut() {
    if (!canSubmit) {
      highlightEmptyForm();
    }

    onSubmit();
  }

  // onCancel이 없는 최상위 작성 폼(답글처럼 닫히는 개념이 없음)에서는 취소 버튼이
  // 입력 중이던 내용을 지우는 역할을 한다.
  function handleClearDraft() {
    form.reset();
    clearAllImages();
  }

  // 제안 버튼을 누르면 포커스가 버튼으로 옮겨 간다 - 링크를 넣은 뒤 바로 이어 쓸 수 있게 입력칸으로 돌려준다
  function handleInsertSuggestedLink() {
    insertSuggestedLink();
    textareaRef.current?.focus({ preventScroll: true });
  }

  const { ref: registerContentRef, ...contentRegister } = register('content');

  return (
    <form onSubmit={onSubmit} className={cn('space-y-2', className)}>
      <div
        ref={containerRef}
        className={cn(
          'relative rounded-md transition-shadow duration-300',
          isDraggingOver && 'ring-2 ring-primary ring-offset-2'
        )}
        onBlur={handleSuggestionAreaBlur}
      >
        {isDraggingOver && (
          <DropTargetOverlay
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
          />
        )}
        <Textarea
          aria-invalid={showValidationHighlight || isOverLimit}
          aria-describedby={contentCountId}
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
          onFocus={handleContentFocus}
          onInput={handleContentInput}
          onKeyDown={(e) => {
            // 예약은 바로 이어지는 조합 종료까지만 유효하다 - 조합이 이어져 다른 키가 오면 푼다
            submitAfterCompositionRef.current = false;

            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();

              if (e.nativeEvent.isComposing) {
                submitAfterCompositionRef.current = true;
                return;
              }

              submitByShortcut();
            }
          }}
          onCompositionEnd={() => {
            if (!submitAfterCompositionRef.current) {
              return;
            }

            submitAfterCompositionRef.current = false;
            submitByShortcut();
          }}
        />
        {suggestedLink && (
          // 입력칸 안 왼쪽 아래에 띄운다. 감싼 줄은 클릭을 받지 않아 버튼 밖을 누르면 입력칸에 커서가 들어간다
          <div className="pointer-events-none absolute inset-x-3 bottom-2 flex">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="pointer-events-auto h-7 min-w-0 max-w-full shrink gap-1 border-info/60 px-2 text-xs text-info hover:bg-info/10 hover:text-info has-[>svg]:px-2 dark:border-info/60 dark:hover:bg-info/15"
              // 누르는 순간 입력칸 포커스가 빠지지 않게 한다 - 빠지면 포커스가 영역 밖으로 나간 것으로 보고 클릭 전에
              // 제안을 내린다. Safari는 클릭한 버튼에 포커스를 주지 않아 옮겨 간 곳도 알 수 없다
              // (https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/button#clicking_and_focus).
              // 같은 방식: RecentSearchDropdown.tsx
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleInsertSuggestedLink}
            >
              <Link2 className="size-3.5" />
              <span className="min-w-0 truncate">
                {suggestedLink.title
                  ? TEXTS.comment.form.insertCopiedLink(suggestedLink.title)
                  : TEXTS.comment.form.insertCopiedLinkUntitled}
              </span>
            </Button>
          </div>
        )}
      </div>

      <div className="flex items-start gap-2">
        {isOverLimit && (
          <p className="min-w-0 flex-1 text-xs text-destructive">
            {TEXTS.validation.commentContentTooLong}
          </p>
        )}
        <CharacterCount
          id={contentCountId}
          current={contentLength}
          max={MAX_COMMENT_CONTENT_HANGUL_CHARS}
          suffix={TEXTS.comment.form.contentCountSuffix}
          className="ml-auto shrink-0"
        />
      </div>

      {contentValue && (
        <div className="rounded-md border bg-muted/30 p-3 text-sm">
          <ToggleButton
            type="button"
            variant="none"
            size="sm"
            className="h-auto min-h-0 w-full justify-between gap-1 p-0 text-xs text-muted-foreground mb-1.5 hover:text-foreground"
            aria-label={
              showPreview ? TEXTS.comment.form.hidePreview : TEXTS.comment.form.showPreview
            }
            onClick={() => setShowPreview((prev) => !prev)}
          >
            {TEXTS.comment.form.preview}
            {showPreview ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </ToggleButton>
          {showPreview && <MarkdownContent content={contentValue} />}
        </div>
      )}

      <div className="mt-2 space-y-2">
        <ImageAttachmentPreviews previewUrls={imagePreviewUrls} onRemove={clearImage} />
        {failureMessage && <FormAlert>{failureMessage}</FormAlert>}
        {/* 왼쪽은 내용을 바꾸는 도구(첨부), 오른쪽은 마무리 동작(취소·등록) - 한 줄로 둬 폼 높이를 줄인다 */}
        <div className="flex items-center justify-between gap-2">
          <ImageAttachmentButton
            count={images.length}
            maxCount={MAX_COMMENT_IMAGES}
            onAttach={addFiles}
          />
          <div className="flex gap-2">
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
                    className="font-sans pointer-coarse:hidden"
                    style={{
                      backgroundColor: 'var(--kbd-in-primary-bg)',
                      color: 'var(--kbd-in-primary-color)',
                    }}
                  >
                    {PlatformUtil.isMac()
                      ? TEXTS.shortcuts.commentSubmitMac
                      : TEXTS.shortcuts.commentSubmit}
                  </Kbd>
                )}
              </Button>
            </TooltipWrapper>
          </div>
        </div>
      </div>
    </form>
  );
});

CommentFormView.displayName = 'CommentFormView';

/** 폼이 상태를 직접 갖는 작성 폼 - 열렸다 닫히는 답글 폼이 쓴다 */
export const CommentForm = forwardRef<CommentFormHandle, CommentFormProps>(function CommentForm(
  { postId, parentId, onCancel, onSuccess, className, autoFocus },
  ref
) {
  const draft = useCreateComment({ postId, parentId, onSuccess, autoFocus });

  return (
    <CommentFormView
      ref={ref}
      postId={postId}
      draft={draft}
      onCancel={onCancel}
      className={className}
    />
  );
});

CommentForm.displayName = 'CommentForm';
