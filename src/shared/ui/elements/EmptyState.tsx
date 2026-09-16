import { ReactNode } from 'react';
import { cn } from '@/shared/lib/tailwind/utils';

export interface EmptyStateProps {
  children: ReactNode;
  className?: string;
}

/**
 * 목록/검색 결과가 비어있을 때 보여주는 중앙 정렬 안내 문구
 *
 * `ErrorState`와 대칭 구조 — 배경·테두리 등 추가 스타일은 `className`으로 얹는다.
 *
 * @example
 * ```tsx
 * <EmptyState className="border rounded-lg bg-muted/10">{TEXTS.messages.info.noPosts}</EmptyState>
 * ```
 */
export function EmptyState({ children, className }: EmptyStateProps) {
  return <div className={cn('text-center py-8 text-muted-foreground', className)}>{children}</div>;
}
