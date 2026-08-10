import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/atoms/tooltip';
import { cn } from '@/shared/lib/tailwind/utils';
import { toast } from '@/shared/lib/toast/toast';

// 연속 탭으로 같은 이유 토스트가 쌓이지 않도록 고정 id를 준다.
const REASON_TOAST_ID = 'tooltip-wrapper-reason';

export const TooltipWrapper = ({
  children,
  content,
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  className?: string;
}) => {
  const showTooltip = !!content;

  // Radix 툴팁은 pointerType === 'touch'를 무시하도록 설계돼 있어(react-tooltip 내부 가드)
  // 터치에서는 hover/focus 어느 경로로도 열리지 않는다. 그래서 탭은 토스트로 대신 알린다.
  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !content) {
      return;
    }
    toast.info(content, { id: REASON_TOAST_ID });
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={showTooltip ? 0 : -1}
          onPointerDown={handlePointerDown}
          className={cn(
            'inline-block outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-md',
            showTooltip && 'cursor-not-allowed',
            className
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      {showTooltip && <TooltipContent>{content}</TooltipContent>}
    </Tooltip>
  );
};
