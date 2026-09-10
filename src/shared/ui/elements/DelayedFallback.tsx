import { ReactNode } from 'react';
import { cn } from '@/shared/lib/tailwind/utils';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { LOADING_INDICATOR_DELAY_MS } from '@/shared/config/const';

export interface DelayedFallbackProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

/**
 * 지연 게이트가 걸린 로딩 표시 래퍼
 *
 * delay가 지나기 전에는 아무것도 렌더하지 않아, 빠르게 끝나는 조회에서 인디케이터가
 * 잠깐 보였다 사라지는 깜빡임을 방지한다. Suspense fallback(스켈레톤 등)과 isLoading
 * 분기 양쪽에 동일하게 쓸 수 있다.
 *
 * 지연이 지난 뒤에는 페이드인으로 나타난다 - 지연 만료 직후 콘텐츠가 도착하는 경계
 * 케이스(예: 지연 500ms에 응답 501ms)에서도 하드 엣지 없이 자연스럽게 사라진다.
 *
 * @example
 * ```tsx
 * <AsyncBoundary loadingFallback={<DelayedFallback><PostListSkeleton /></DelayedFallback>}>
 * ```
 */
export function DelayedFallback({
  children,
  className,
  delay = LOADING_INDICATOR_DELAY_MS,
}: DelayedFallbackProps) {
  const showLoading = useDelayedLoading(true, delay);

  if (!showLoading) {
    return null;
  }

  return <div className={cn('animate-in fade-in duration-200', className)}>{children}</div>;
}
