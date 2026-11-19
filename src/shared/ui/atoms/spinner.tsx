import { Loader2Icon } from 'lucide-react';

import { cn } from '@/shared/lib/tailwind/utils';
import { useUiTexts } from '@/shared/ui/texts/UiTextsProvider';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  const uiTexts = useUiTexts();

  return (
    <Loader2Icon
      role="status"
      aria-label={uiTexts.spinner.label}
      className={cn('size-4 animate-spin', className)}
      {...props}
    />
  );
}

export { Spinner };
