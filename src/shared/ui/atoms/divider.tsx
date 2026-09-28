import { cn } from '@/shared/lib/tailwind/utils';

function Divider({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="divider"
      className={cn('h-px w-full shrink-0 bg-border', className)}
      {...props}
    />
  );
}

export { Divider };
