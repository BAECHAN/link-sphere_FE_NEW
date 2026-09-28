import { ReactNode } from 'react';
import { cn } from '@/shared/lib/tailwind/utils';

export interface LabeledDividerProps {
  children: ReactNode;
  className?: string;
}

/**
 * 가운데 텍스트를 좌우 구분선으로 감싸는 "OR 구분선"류 패턴.
 */
export function LabeledDivider({ children, className }: LabeledDividerProps) {
  return (
    <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
      <div className="h-px flex-1 bg-border" />
      {children}
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
