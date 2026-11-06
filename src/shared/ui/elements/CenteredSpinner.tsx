import { Spinner } from '@/shared/ui/atoms/spinner';
import { cn } from '@/shared/lib/tailwind/utils';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { LOADING_INDICATOR_DELAY_MS } from '@/shared/config/const';

export interface CenteredSpinnerProps {
  className?: string;
  spinnerClassName?: string;
  delay?: number;
}

/**
 * 부모 요소의 중앙에 스피너를 표시하는 컴포넌트(부모를 덮지 않는다)
 * useDelayedLoading을 적용하여 짧은 로딩 시 깜빡임을 방지합니다.
 * 자체적으로 지연 게이트를 갖고 있으므로 DelayedFallback으로 다시 감싸지 않는다.
 */
export function CenteredSpinner({
  className,
  spinnerClassName,
  delay = LOADING_INDICATOR_DELAY_MS,
}: CenteredSpinnerProps) {
  const isDelayedLoading = useDelayedLoading(true, delay);

  if (!isDelayedLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex h-full w-full items-center justify-center p-10 animate-in fade-in duration-200',
        className
      )}
    >
      <Spinner className={cn('size-10 animate-spin', spinnerClassName)} />
    </div>
  );
}
