import { LinkThumbnail } from '@/shared/ui/atoms/link-thumbnail';
import { Skeleton } from '@/shared/ui/atoms/skeleton';
import { TEXTS } from '@/shared/config/texts';
import type { LinkPreviewState } from '@/entities/post/hooks/useLinkPreview';

interface LinkPreviewCardProps {
  state: LinkPreviewState;
  /** 사용자가 제목을 직접 입력했으면 그 제목으로 보여준다 - 등록되는 제목과 맞춘다 */
  titleOverride?: string;
}

// 썸네일 열 너비 - 모바일은 좁혀 본문이 두 줄 이상 들어가게 한다(시안 비교 후 가로형 L1 채택,
// docs/DECISIONS.md 2026-10-03 "게시글 등록·수정: 기다리지 않고 이동 → 응답 대기" 항목)
const CARD_GRID_CLASSNAME =
  'grid grid-cols-[104px_1fr] items-center overflow-hidden rounded-lg border bg-muted/30 sm:grid-cols-[128px_1fr]';

/**
 * 등록·수정 폼의 URL 칸 바로 아래에 붙는 링크 미리보기. "이렇게 등록돼요"를 등록 전에 확인하게
 * 한다(Slack·LinkedIn의 작성 중 미리보기와 같은 위치). 가져오는 동안은 같은 높이의 스켈레톤을
 * 깔아 결과가 와도 아래 폼이 밀리지 않게 한다. 기존 댓글 링크 미리보기(CommentItem)의 색·테두리를
 * 그대로 쓴다.
 */
export function LinkPreviewCard({ state, titleOverride }: LinkPreviewCardProps) {
  if (state.status === 'idle' || state.status === 'urlError') {
    return null;
  }

  if (state.status === 'failed') {
    return (
      <p className="rounded-lg border px-3 py-2.5 text-sm text-muted-foreground" aria-live="polite">
        {TEXTS.post.form.preview.failed}
      </p>
    );
  }

  if (state.status === 'loading') {
    return (
      <div
        className={CARD_GRID_CLASSNAME}
        aria-busy="true"
        aria-label={TEXTS.post.form.preview.ariaLabel}
      >
        <Skeleton className="aspect-video w-full rounded-none" />
        <div className="flex min-w-0 flex-col gap-1.5 p-2.5">
          <Skeleton className="h-3.5 w-3/4" />
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {TEXTS.post.form.preview.loading}
          </p>
        </div>
      </div>
    );
  }

  const { preview } = state;
  const title = titleOverride?.trim() || preview.title;
  const hasMetadata = Boolean(preview.description || preview.ogImage);

  return (
    <div className={CARD_GRID_CLASSNAME} aria-label={TEXTS.post.form.preview.ariaLabel}>
      {preview.ogImage ? (
        <LinkThumbnail src={preview.ogImage} alt={title} />
      ) : (
        <div className="aspect-video w-full bg-muted" aria-hidden="true" />
      )}
      <div className="flex min-w-0 flex-col gap-0.5 p-2.5">
        {/* eslint-disable-next-line custom-tailwind/no-raw-title -- 외부 링크 메타데이터 제목, UI 제목 아님 */}
        <p className="truncate text-sm font-semibold">{title}</p>
        {hasMetadata ? (
          preview.description && (
            <p className="line-clamp-2 text-xs text-muted-foreground">{preview.description}</p>
          )
        ) : (
          <p className="text-xs text-muted-foreground">{TEXTS.post.card.metadataUnavailable}</p>
        )}
        <p className="truncate text-xs text-muted-foreground">{preview.url}</p>
      </div>
    </div>
  );
}
