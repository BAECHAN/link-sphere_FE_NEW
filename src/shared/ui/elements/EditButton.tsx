import { forwardRef } from 'react';
import { Pencil } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';

// type·children과 label에서 만드는 aria-label·title은 이 부품이 정한다 - 타입에서 빼고, 아래에서 나머지 속성을 먼저
// 펼친 뒤 다시 적어 넘겨받은 값이 이기지 못하게 한다. 하이픈이 든 aria-label은 타입에서 빼도 JSX에서 타입 오류가
// 나지 않아 펼치는 순서가 막는다(docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4)
export interface EditButtonProps extends Omit<
  React.ComponentPropsWithoutRef<'button'>,
  'type' | 'children' | 'aria-label' | 'title'
> {
  /** 화면 읽기 프로그램 이름(aria-label)과 마우스 힌트(title)에 함께 쓴다 */
  label: string;
  onClick: () => void;
  className?: string;
}

/** 연필 아이콘만 있는 수정 버튼 — hover 힌트는 PostCard 잠금 버튼처럼 브라우저 기본 title로 준다 */
export const EditButton = forwardRef<HTMLButtonElement, EditButtonProps>(
  ({ label, onClick, className, ...props }, ref) => (
    <Button
      ref={ref}
      {...props}
      type="button"
      variant="ghost"
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn('h-8 w-8 shrink-0 text-muted-foreground', className)}
    >
      <Pencil className="h-4 w-4" />
    </Button>
  )
);
EditButton.displayName = 'EditButton';
