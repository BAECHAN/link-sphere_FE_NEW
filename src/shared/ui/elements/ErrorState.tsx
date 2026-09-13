import { ReactNode } from 'react';
import { cn } from '@/shared/lib/tailwind/utils';

export interface ErrorStateProps {
  children: ReactNode;
  className?: string;
}

/**
 * 목록/상세 조회 실패 시 보여주는 중앙 정렬 에러 문구
 *
 * `AsyncBoundary`의 `errorFallback`에 쓰는 것을 기본 형태로 상정한다.
 *
 * @example
 * ```tsx
 * <AsyncBoundary errorFallback={() => <ErrorState>{TEXTS.messages.error.fetchPosts}</ErrorState>}>
 * ```
 */
export function ErrorState({ children, className }: ErrorStateProps) {
  return <div className={cn('text-center py-12 text-destructive', className)}>{children}</div>;
}
