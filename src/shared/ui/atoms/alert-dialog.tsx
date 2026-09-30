import * as React from 'react';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import { X } from 'lucide-react';

import { cn } from '@/shared/lib/tailwind/utils';
import { useOpenClickGuard } from '@/shared/hooks/useOpenClickGuard';

// 응답을 받아야 하는 확인창(삭제·이탈 등) 전용 — role="alertdialog"로 렌더돼 스크린리더가
// "경고 대화상자"로 안내한다(W3C APG Alert Dialog 패턴). 모양과 가드는 dialog.tsx를 그대로
// 따른다. 바깥(오버레이) 클릭은 Radix AlertDialog가 항상 막으므로 dialog.tsx의 바깥 클릭용
// 가드(열린 직후 pointerdown·마우스 뒤로가기 버튼)와 dismissOnOutsideClick은 두지 않는다
// (docs/DECISIONS.md 2026-09-30 "확인창을 Radix AlertDialog로 교체").

const AlertDialog = AlertDialogPrimitive.Root;

const AlertDialogTrigger = AlertDialogPrimitive.Trigger;

const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-modal bg-scrim/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

type AlertDialogContentProps = React.ComponentPropsWithoutRef<
  typeof AlertDialogPrimitive.Content
> & {
  showCloseButton?: boolean;
};

// dialog.tsx의 DialogContentPanel과 같은 이유로 가드 훅을 Portal(Presence) 안쪽 컴포넌트에
// 둔다 — 닫힌 채 마운트됐다가 나중에 열려도 가드 시계가 "열린 시점"부터 돌게 하기 위해서다.
const AlertDialogContentPanel = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>(
  (
    { className, children, showCloseButton = true, onEscapeKeyDown, onClickCapture, ...props },
    ref
  ) => {
    // 열린 직후(더블클릭/더블탭) 확인창 안의 취소·확인 버튼에 두 번째 클릭이 떨어져
    // 의도치 않게 확정되는 것을 막는다 — dialog.tsx의 onClickCapture 가드와 같다.
    const isOpenClickGuarded = useOpenClickGuard(true);

    return (
      <AlertDialogPrimitive.Content
        ref={ref}
        onEscapeKeyDown={(e) => {
          // 한글 등 IME 조합 중 ESC가 두 번 들어와 닫힘이 중복되는 것을 막는다(dialog.tsx와 같다).
          if (e.isComposing) {
            e.preventDefault();
            return;
          }
          onEscapeKeyDown?.(e);
        }}
        onClickCapture={(e) => {
          if (isOpenClickGuarded()) {
            e.preventDefault();
            e.stopPropagation();
            return;
          }
          onClickCapture?.(e);
        }}
        className={cn(
          'fixed left-[50%] top-[50%] z-modal grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg',
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <AlertDialogPrimitive.Cancel className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </AlertDialogPrimitive.Cancel>
        )}
      </AlertDialogPrimitive.Content>
    );
  }
);
AlertDialogContentPanel.displayName = 'AlertDialogContentPanel';

const AlertDialogContent = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Content>,
  AlertDialogContentProps
>((props, ref) => (
  <AlertDialogPortal>
    <AlertDialogOverlay />
    <AlertDialogContentPanel ref={ref} {...props} />
  </AlertDialogPortal>
));
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Title
    ref={ref}
    className={cn('text-section-title tracking-tight', className)}
    {...props}
  />
));
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription = React.forwardRef<
  React.ElementRef<typeof AlertDialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <AlertDialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
AlertDialogDescription.displayName = AlertDialogPrimitive.Description.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
};
