import { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';

export interface ActionButtonProps {
  label: string;
  onClick: () => void;
  className?: string;

  icon?: LucideIcon;
  iconClassName?: string;
  /** true면 라벨을 시각적으로 숨기고 sr-only로만 남긴다 (아이콘만 표시) - PostCard의
   * 북마크·공유 버튼과 동일한 패턴 */
  iconOnly?: boolean;
}

export function ActionButton({
  label,
  onClick,
  className,
  icon: Icon,
  iconClassName,
  iconOnly,
}: ActionButtonProps) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className={cn('flex items-center gap-1 transition-colors h-auto p-0', className)}
    >
      {Icon && <Icon className={cn('h-3.5 w-3.5', iconClassName)} />}
      <span className={cn(iconOnly && 'sr-only')}>{label}</span>
    </Button>
  );
}
