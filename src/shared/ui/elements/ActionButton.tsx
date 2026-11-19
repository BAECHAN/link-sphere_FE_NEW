import { forwardRef } from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';

// type·children은 이 부품이 정한다 - 쓰는 쪽이 바꿀 수 없게 타입에서 뺀다(docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4)
export interface ActionButtonProps extends Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'type' | 'children'
> {
  label: string;
  onClick: () => void;
  className?: string;

  icon?: LucideIcon;
  iconClassName?: string;
}

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({ label, onClick, className, icon: Icon, iconClassName, ...props }, ref) => (
    <Button
      ref={ref}
      {...props}
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn('flex items-center gap-1 transition-colors h-auto p-0', className)}
    >
      {Icon && <Icon className={cn('size-4', iconClassName)} />}
      <span>{label}</span>
    </Button>
  )
);
ActionButton.displayName = 'ActionButton';
