import { forwardRef } from 'react';
import { cn } from '@baechan/ui/lib/tailwind/utils';
import { ToggleButton } from '@/shared/ui/elements/ToggleButton';

// type·children과 isActive에서 만드는 aria-pressed는 이 부품이 정한다 - 타입에서 빼고, 아래에서 나머지 속성을 먼저
// 펼친 뒤 다시 적어 넘겨받은 값이 이기지 못하게 한다. 하이픈이 든 aria-pressed는 타입에서 빼도 JSX에서 타입 오류가
// 나지 않아 펼치는 순서가 막는다(docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4)
export interface FilterChipProps extends Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'type' | 'children' | 'aria-pressed'
> {
  label: string;
  isActive: boolean;
  onClick: () => void;
  activeClassName: string;
  className?: string;
  // 기본 button 속성이라 나머지 속성으로도 받지만, Storybook 자동 속성 표는 여기 직접 적은 속성만 보여 줘서 다시
  // 적는다(docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4)
  id?: string;
  name?: string;
}

export const FilterChip = forwardRef<HTMLButtonElement, FilterChipProps>(
  ({ label, isActive, onClick, activeClassName, className, ...props }, ref) => (
    <ToggleButton
      ref={ref}
      {...props}
      type="button"
      variant="none"
      onClick={onClick}
      // 켜짐이 색으로만 보이면 화면 읽기 프로그램에 전달되지 않는다.
      // https://www.w3.org/WAI/ARIA/apg/patterns/button/
      aria-pressed={isActive}
      className={cn(
        // 2026-09-06, 사용자 확인 후 44px(모바일 터치 타깃) → 28px(데스크톱과 동일)로
        // 되돌림 — 시각적 일관성 우선 결정, docs/DECISIONS.md 참고
        // eslint-disable-next-line custom-tailwind/no-raw-title -- 칩 라벨, 제목 아님
        'rounded-full px-3 py-1.5 h-auto text-xs font-bold transition-all transform active:scale-95',
        isActive
          ? cn(activeClassName, 'shadow-sm')
          : 'bg-muted text-muted-foreground border border-transparent',
        className
      )}
    >
      {label}
    </ToggleButton>
  )
);
FilterChip.displayName = 'FilterChip';
