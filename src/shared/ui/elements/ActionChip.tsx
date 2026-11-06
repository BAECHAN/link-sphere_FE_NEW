import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';

export interface ActionChipProps {
  label: string;
  onClick: () => void;
  'aria-label'?: string;
  /** 버튼에 붙는 클래스 — 쌓임 순서 등 위치 커스텀에 사용 */
  className?: string;
  /** 눈에 보이는 칩에 붙는 클래스 — 색상 커스텀에 사용 */
  labelClassName?: string;
}

/**
 * 누르면 동작을 실행하는 칩. 켜고 끄는 상태가 없다 - 상태를 켜고 끄면 `FilterChip`, 누를 수 없는
 * 라벨이면 `Badge`를 쓴다(docs/FE-ARCHITECTURE.md §18).
 *
 * 칩 모양은 그대로 두고 버튼의 py-0.5 -my-0.5로 누르는 영역만 24px 이상으로 넓힌다 - 카드 전체가
 * 링크인 자리에서는 WCAG 2.5.8 간격 예외를 받을 수 없어서다(docs/SEARCH.md).
 */
export function ActionChip({
  label,
  onClick,
  'aria-label': ariaLabel,
  className,
  labelClassName,
}: ActionChipProps) {
  return (
    <Button
      type="button"
      variant="none"
      className={cn('group h-auto px-0 py-0.5 -my-0.5 rounded-full', className)}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center gap-1 w-fit shrink-0 overflow-hidden rounded-full border border-transparent bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground whitespace-nowrap select-none transition-[color,box-shadow] group-hover:underline underline-offset-2',
          labelClassName
        )}
      >
        {label}
      </span>
    </Button>
  );
}
