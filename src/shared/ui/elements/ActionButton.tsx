import { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';

export interface ActionButtonProps {
  label: string;
  onClick: () => void;
  className?: string;

  icon?: LucideIcon;
  iconClassName?: string;
}

export function ActionButton({
  label,
  onClick,
  className,
  icon: Icon,
  iconClassName,
}: ActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn('flex items-center gap-1 transition-colors h-auto p-0', className)}
    >
      {Icon && <Icon className={cn('h-3.5 w-3.5', iconClassName)} />}
      <span>{label}</span>
    </Button>
  );
}
