import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';

interface FilterChipProps {
  label: string;
  isActive: boolean;
  onClick: () => void;
  activeClassName: string;
  id?: string;
  name?: string;
}

export function FilterChip({
  label,
  isActive,
  onClick,
  activeClassName,
  id,
  name,
}: FilterChipProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      id={id}
      name={name}
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 h-auto text-xs font-bold transition-all transform active:scale-95',
        isActive
          ? cn(activeClassName, 'shadow-sm')
          : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground border border-transparent'
      )}
    >
      {label}
    </Button>
  );
}
