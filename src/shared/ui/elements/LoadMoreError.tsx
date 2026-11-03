import { RotateCw } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';

export interface LoadMoreErrorProps {
  onRetry: () => void;
  className?: string;
}

/**
 * 무한 스크롤 목록 끝에서 다음 페이지를 받지 못했을 때 스피너 자리에 두는 안내 + 다시 시도 행.
 * 실패하면 목록은 자동으로 다시 받지 않으므로, 이 버튼이 다음 페이지를 받는 길이다(docs/POST.md 무한 스크롤).
 *
 * @example
 * ```tsx
 * {isNextPageFailed && <LoadMoreError onRetry={retryNextPage} />}
 * ```
 */
export function LoadMoreError({ onRetry, className }: LoadMoreErrorProps) {
  return (
    <div className={cn('flex flex-col items-center gap-2 p-4', className)}>
      <p className="text-sm text-muted-foreground">{TEXTS.messages.error.loadMoreFailed}</p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        <RotateCw aria-hidden="true" />
        {TEXTS.buttons.retry}
      </Button>
    </div>
  );
}
