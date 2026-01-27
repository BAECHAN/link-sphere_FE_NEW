import { Spinner } from '@/shared/ui/atoms/spinner';
import { cn } from '@/shared/lib/tailwind/utils';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';

interface SpinnerOverlayProps {
  className?: string;
  spinnerClassName?: string;
  delay?: number;
}

/**
 * 부모 요소를 기준으로 중앙에 스피너를 표시하는 오버레이 컴포넌트
 * useDelayedLoading을 적용하여 짧은 로딩 시 깜빡임을 방지합니다.
 */
export function SpinnerOverlay({ className, spinnerClassName, delay = 500 }: SpinnerOverlayProps) {
  const isDelayedLoading = useDelayedLoading(true, delay);

  if (!isDelayedLoading) return null;

  return (
    <div className={cn('flex h-full w-full items-center justify-center p-10', className)}>
      <Spinner className={cn('size-10 animate-spin', spinnerClassName)} />
    </div>
  );
}
