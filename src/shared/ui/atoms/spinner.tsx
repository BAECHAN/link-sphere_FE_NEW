import { Loader2Icon } from 'lucide-react';

import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <Loader2Icon
      role="status"
      aria-label={TEXTS.ariaLabels.loading}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
