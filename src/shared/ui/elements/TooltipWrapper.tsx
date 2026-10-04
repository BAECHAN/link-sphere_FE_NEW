import { useEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/shared/ui/atoms/tooltip';
import { cn } from '@/shared/lib/tailwind/utils';
import { toast } from '@/shared/lib/toast/toast';

// 연속 탭으로 같은 이유 토스트가 쌓이지 않도록 고정 id를 준다.
const REASON_TOAST_ID = 'tooltip-wrapper-reason';

function isTextEditable(node: EventTarget | null): boolean {
  return (
    node instanceof HTMLElement &&
    (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA' || node.isContentEditable)
  );
}

export const TooltipWrapper = ({
  children,
  content,
  disabled,
  className,
}: {
  children: React.ReactNode;
  content: React.ReactNode;
  disabled: boolean;
  className?: string;
}) => {
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  // 같은 폼 안의 다른 입력창(닉네임 등)에 타이핑하면 즉시 닫는다. 시간이 지난다고 저절로 다시
  // 뜨지는 않는다 - Radix는 포인터가 트리거를 실제로 벗어났다가 다시 들어와야만 "새로 진입"으로
  // 인식해 다시 열기를 시도하므로(react-tooltip 내부의 hasPointerMoveOpenedRef), 마우스가
  // 계속 트리거 위에 있어도 우리가 false로 만든 뒤로는 Radix가 스스로 true로 되돌리지 않는다.
  // 마우스를 뺐다가 다시 넣어야만 그때 다시 뜬다.
  useEffect(() => {
    const trigger = triggerRef.current;
    const form = trigger?.closest('form');
    if (!form) {
      return;
    }

    function handleInput(e: Event) {
      if (!isTextEditable(e.target) || trigger?.contains(e.target as Node)) {
        return;
      }
      setVisible(false);
    }

    form.addEventListener('input', handleInput);
    return () => form.removeEventListener('input', handleInput);
  }, []);

  const [frozenContent, setFrozenContent] = useState(content);

  // 보이는 동안(호버 유지 중)엔 content가 바뀌어도(예: 닉네임 디바운스로 이유가 사라짐) 문구를
  // 고정한다 - 그대로 두면 조건부 렌더가 매번 언마운트→재마운트되며 등장 애니메이션이 깜빡인다.
  // 안 보일 때만 최신값을 반영해 다음에 뜰 때 새 이유를 보여준다.
  // 렌더 중에 맞춘다 - effect에서 하면 낡은 문구로 한 번 더 렌더된다
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (!visible && frozenContent !== content) {
    setFrozenContent(content);
  }

  const showTooltip = !!frozenContent;

  // Radix 툴팁은 pointerType === 'touch'를 무시하도록 설계돼 있어(react-tooltip 내부 가드)
  // 터치에서는 hover/focus 어느 경로로도 열리지 않는다. 그래서 탭은 토스트로 대신 알린다.
  // 탭은 순간 이벤트라 호버 중 갈아치움 문제가 없으므로 항상 최신 content를 쓴다.
  const suppressHoverUntilRef = useRef(0);

  const handlePointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== 'touch' || !content) {
      return;
    }

    // 터치스크린 노트북·Chrome DevTools 기기 툴바 같은 하이브리드 입력은 터치와 함께 마우스
    // hover 이벤트도 동반 발생시켜 Radix 툴팁이 뒤늦게 열릴 수 있다(TooltipProvider가
    // delayDuration={0}이라 hover는 즉시 열림, App.tsx). 터치 시점 기준 짧은 시간 동안 hover로
    // 인한 open 요청을 무시해 토스트와 중복 노출되지 않게 한다.
    suppressHoverUntilRef.current = Date.now() + 500;
    setVisible(false);
    toast.info(content, { id: REASON_TOAST_ID });
  };

  const isHoverSuppressed = () => Date.now() < suppressHoverUntilRef.current;

  const handleOpenChange = (open: boolean) => {
    if (open && isHoverSuppressed()) {
      return;
    }
    setVisible(open);
  };

  return (
    <Tooltip open={visible} onOpenChange={handleOpenChange}>
      <TooltipTrigger asChild>
        <span
          ref={triggerRef}
          // 키보드 포커스로는 열리지 않도록 의도적으로 포커스를 받지 않는다(hover 전용) - 트레이드
          // 오프로 키보드만 쓰는 사용자는 이 이유를 볼 수 없다.
          tabIndex={-1}
          onPointerDown={handlePointerDown}
          className={cn('inline-block', disabled && 'cursor-not-allowed', className)}
        >
          {children}
        </span>
      </TooltipTrigger>
      {showTooltip && <TooltipContent>{frozenContent}</TooltipContent>}
    </Tooltip>
  );
};
