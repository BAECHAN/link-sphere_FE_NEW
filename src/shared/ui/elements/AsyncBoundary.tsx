import { Suspense, ReactNode, ErrorInfo } from 'react';
import { ErrorBoundary, FallbackProps } from 'react-error-boundary';
import { TEXTS } from '@/shared/config/texts';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { ErrorUtil } from '@/shared/utils/error.util';

export interface AsyncBoundaryProps {
  children: ReactNode;
  /**
   * 로딩 중 표시할 컴포넌트
   * @default SpinnerOverlay
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
  /**
   * 이 배열의 값 중 하나라도 바뀌면 에러 상태를 풀고 children을 다시 그린다(그때 onReset도 호출).
   * 없으면 에러 화면이 리마운트 전까지 남는다 - 같은 화면에서 조회 조건이 바뀌는 곳(검색 필터 등)에 넘긴다
   */
  resetKeys?: unknown[];
}

/**
 * 기본 에러 폴백 - 날것의 error.message를 사용자에게 노출하지 않는다.
 * 실제 에러는 AsyncBoundary의 onError에서 console.error로 남긴다.
 */
function DefaultErrorFallback({ error }: FallbackProps) {
  return (
    <ErrorLayout
      title={TEXTS.errors.unexpected.title}
      description={ErrorUtil.resolveMessage(error)}
    />
  );
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
  resetKeys,
}: AsyncBoundaryProps) {
  const handleError = (error: Error, info: ErrorInfo) => {
    console.error('[AsyncBoundary]', error);
    onError?.(error, info);
  };

  return (
    <ErrorBoundary
      FallbackComponent={errorFallback || DefaultErrorFallback}
      onError={handleError}
      onReset={onReset}
      resetKeys={resetKeys}
    >
      <Suspense fallback={loadingFallback}>{children}</Suspense>
    </ErrorBoundary>
  );
}
