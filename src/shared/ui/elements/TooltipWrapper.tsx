import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/atoms/tooltip';
import { cn } from '@/shared/lib/tailwind/utils';

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

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={showTooltip ? 0 : -1}
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
