import { MoreVertical } from 'lucide-react';
import { ReactNode } from 'react';
import { Button } from '@/shared/ui/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import { cn } from '@/shared/lib/tailwind/utils';

export interface HoverKebabMenuProps {
  'aria-label': string;
  children: ReactNode;
  /** 메뉴 항목 안 `DropdownMenuContent`에 붙는 클래스 */
  className?: string;
  /** 트리거 버튼에 붙는 클래스 — 위치 커스텀(예: absolute) 등에 사용 */
  triggerClassName?: string;
  /** true면 평소엔 숨겼다가 부모의 `group` hover/열림 시에만 보인다. 부모 요소에
   * `group` 클래스가 있어야 동작한다(FolderTree.tsx의 `.group` 선례 참고) */
  hoverReveal?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/**
 * ⋮ 트리거 + DropdownMenu 셸을 감싼 compound 컴포넌트. PostCard·FolderTree·
 * MobileFolderList가 각자 구현하던 거의 같은 마크업(ghost 아이콘 버튼 + MoreVertical +
 * DropdownMenu)을 통합했다(2026-09-29, docs/DECISIONS.md 참고). 메뉴 항목(수정·삭제·
 * 이름변경 등)은 도메인마다 달라 여기서 정의하지 않고 children으로 호출부가 채운다.
 */
export function HoverKebabMenu({
  'aria-label': ariaLabel,
  children,
  className,
  triggerClassName,
  hoverReveal = false,
  open,
  onOpenChange,
}: HoverKebabMenuProps) {
  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={ariaLabel}
          className={cn(
            hoverReveal && 'opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100',
            triggerClassName
          )}
        >
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={className}>
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
