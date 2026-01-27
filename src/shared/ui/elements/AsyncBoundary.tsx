import { Suspense, ReactNode, ErrorInfo } from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { TEXTS } from '@/shared/config/texts';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';

interface AsyncBoundaryProps {
  children: ReactNode;
  /**
   * 로딩 중 표시할 컴포넌트
   * @default GlobalLoading
   */
  loadingFallback?: ReactNode;
  /**
   * 에러 발생 시 표시할 컴포넌트
   * 제공하지 않으면 기본 에러 UI 사용
   */
  errorFallback?: (props: FallbackProps) => ReactNode;
  /**
   * 에러 발생 시 실행할 콜백
   */
  onError?: (error: Error, info: ErrorInfo) => void;
  /**
   * 에러 발생 시 재시도 핸들러
   * 제공하지 않으면 재시도 버튼 표시
   */
  onReset?: () => void;
}

/**
 * AsyncBoundary
 *
 * Suspense와 ErrorBoundary를 조합한 래퍼 컴포넌트
 * React Query와 함께 사용하여 로딩/에러 처리를 단순화
 *
 * @example
 * ```tsx
 * <AsyncBoundary>
 *   <PostList /> // useQuery 내부에서 suspense 사용
 * </AsyncBoundary>
 * ```
 */
export function AsyncBoundary({
  children,
  loadingFallback = <SpinnerOverlay />,
  errorFallback,
  onError,
  onReset,
}: AsyncBoundaryProps) {
  const defaultErrorFallback = ({ error }: FallbackProps) => {
    const errorMessage = error instanceof Error ? error.message : TEXTS.messages.error.defaultError;
    return <ErrorLayout title="오류 발생" description={errorMessage} />;
  };

  return (
    <ErrorBoundary
      FallbackComponent={errorFallback || defaultErrorFallback}
      onError={onError}
      onReset={onReset}
    >
      <Suspense fallback={loadingFallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
