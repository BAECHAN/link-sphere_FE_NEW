import { forwardRef } from 'react';
import { Loader2Icon } from 'lucide-react';

import { cn } from '@link-sphere/ui/lib/tailwind/utils';
import { useUiTexts } from '@link-sphere/ui/texts/UiTextsProvider';

const Spinner = forwardRef<SVGSVGElement, React.ComponentPropsWithoutRef<'svg'>>(
  ({ className, ...props }, ref) => {
    const uiTexts = useUiTexts();

    return (
      <Loader2Icon
        ref={ref}
        role="status"
        aria-label={uiTexts.spinner.label}
        className={cn('size-4 animate-spin', className)}
        {...props}
      />
    );
  }
);
Spinner.displayName = 'Spinner';

export { Spinner };
