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
        // 2026-09-06, 사용자 확인 후 44px(모바일 터치 타깃) → 28px(데스크톱과 동일)로
        // 되돌림 — 시각적 일관성 우선 결정, docs/DECISIONS.md 참고
        'rounded-full px-3 py-1.5 h-auto text-xs font-bold transition-all transform active:scale-95',
        isActive
          ? cn(activeClassName, 'shadow-sm')
          : 'bg-muted text-muted-foreground border border-transparent hover:bg-muted hover:text-muted-foreground'
      )}
    >
      {label}
    </Button>
  );
}
