import { Pencil } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';

export interface EditButtonProps {
  /** 화면 읽기 프로그램 이름(aria-label)과 마우스 힌트(title)에 함께 쓴다 */
  label: string;
  onClick: () => void;
  className?: string;
}

/** 연필 아이콘만 있는 수정 버튼 — hover 힌트는 PostCard 잠금 버튼처럼 브라우저 기본 title로 준다 */
export function EditButton({ label, onClick, className }: EditButtonProps) {
  return (
    <Button
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
  );
}
