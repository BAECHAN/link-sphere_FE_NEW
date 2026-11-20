import { forwardRef } from 'react';

import { cn } from '@link-sphere/ui/lib/tailwind/utils';

const Divider = forwardRef<HTMLDivElement, React.ComponentPropsWithoutRef<'div'>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      data-slot="divider"
      className={cn('h-px w-full shrink-0 bg-border', className)}
      {...props}
    />
  )
);
Divider.displayName = 'Divider';

export { Divider };
