import { forwardRef, ReactNode } from 'react';
import { cn } from '@/shared/lib/tailwind/utils';

export interface LabeledDividerProps extends React.ComponentPropsWithoutRef<'div'> {
  children: ReactNode;
}

/**
 * 가운데 텍스트를 좌우 구분선으로 감싸는 "OR 구분선"류 패턴.
 */
export const LabeledDivider = forwardRef<HTMLDivElement, LabeledDividerProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}
      {...props}
    >
      <div className="h-px flex-1 bg-border" />
      {children}
      <div className="h-px flex-1 bg-border" />
    </div>
  )
);
LabeledDivider.displayName = 'LabeledDivider';
