import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { cn } from '@/shared/lib/tailwind/utils';
import { useOpenClickGuard } from '@/shared/hooks/useOpenClickGuard';

const Dialog = DialogPrimitive.Root;

const DialogTrigger = DialogPrimitive.Trigger;

const DialogPortal = DialogPrimitive.Portal;

const DialogClose = DialogPrimitive.Close;

function isBackForwardMouseButton(button: number): boolean {
  return button === 3 || button === 4;
}

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-modal bg-scrim/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className
    )}
    {...props}
  />
));
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  showCloseButton?: boolean;
  /**
   * false면 바깥(오버레이) 클릭으로 닫지 않는다. ESC·닫기 버튼·뒤로가기는 그대로 닫힌다.
   * 닫히면 사용자가 입력한 내용이 사라지는 모달(입력이 생긴 로그인 모달 등)에 쓴다
   * (docs/DECISIONS.md 2026-09-30 "바깥 클릭 닫기 정책"). 확인창(Alert/Confirm)은 이 prop
   * 대신 alert-dialog.tsx(Radix AlertDialog)가 바깥 클릭을 항상 막는다.
   */
  dismissOnOutsideClick?: boolean;
};

// DialogPortal의 자식은 Radix Presence로 감싸져 열릴 때만 마운트된다. 가드 훅을 이 컴포넌트
// 안에 두는 이유가 그것이다 — DialogContent 함수 본문은 닫혀 있어도 항상 실행되므로, 거기서
// useOpenClickGuard(true)를 부르면 시계가 "열린 시점"이 아니라 페이지에 처음 렌더된 시점에
// 한 번 찍히고 끝나 가드가 사실상 꺼진다(2026-09-30 발견, <Dialog open={false}>로 미리
// 마운트해 두는 BookmarkFolderSelectDialog 등에서 열린 직후 바깥 클릭이 그대로 닫았다).
const DialogContentPanel = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>(
  (
    {
      className,
      children,
      showCloseButton = true,
      dismissOnOutsideClick = true,
      onPointerDownOutside,
      onEscapeKeyDown,
      onClickCapture,
      ...props
    },
    ref
  ) => {
    // 모달이 뜬 직후(더블클릭/더블탭 등으로) 들어오는 클릭을 무의식적인 중복 입력으로
    // 보고 무시한다 — 안 그러면 방금 뜬 확인창의 취소/삭제 버튼이나 바깥 오버레이에
    // 두 번째 클릭이 떨어져 "열리자마자 닫히거나 의도치 않게 확정"된다. 원래
    // BookmarkFolderSelectDialog 한 곳에만 배선돼 있던 가드를 모든 Dialog 기반 모달에
    // 적용하기 위해 여기로 올렸다(docs/BOOKMARK.md §5, docs/plans/2026-09-29-dialog-open-click-guard.md 참고).
    const isOpenClickGuarded = useOpenClickGuard(true);

    return (
      <DialogPrimitive.Content
        ref={ref}
        onPointerDownOutside={(e) => {
          // 마우스 뒤로가기/앞으로가기 버튼 클릭은 페이지에도 pointerdown을 발생시킨다.
          // 그 좌표가 다이얼로그 바깥이면 "바깥 클릭으로 닫기"로 오인되어, 브라우저의
          // 실제 back navigation과 별개로 다이얼로그가 먼저 닫히며(오버레이에 따라
          // navigate(-1)까지 실행) 클릭 한 번이 히스토리를 두 단계 소모하게 된다.
          if (isBackForwardMouseButton(e.detail.originalEvent.button)) {
            e.preventDefault();
            return;
          }

          if (isOpenClickGuarded()) {
            e.preventDefault();
            return;
          }

          if (!dismissOnOutsideClick) {
            e.preventDefault();
            return;
          }
          onPointerDownOutside?.(e);
        }}
        onEscapeKeyDown={(e) => {
          // 한글 등 IME 조합 중 ESC는 브라우저가 keydown을 두 번 보낼 수 있다(조합 취소분 +
          // 실제 Escape). 조합 중인 첫 이벤트까지 dismiss로 처리하면 히스토리로 닫는 오버레이는
          // navigate(-1)이 두 번 나가 배경 페이지까지 뒤로 이동해버린다.
          if (e.isComposing) {
            e.preventDefault();
            return;
          }
          onEscapeKeyDown?.(e);
        }}
        onClickCapture={(e) => {
          // 모달 안(취소/확인/닫기 버튼, 폼 등)에 떨어지는 열린 직후 클릭도 캡처
          // 단계에서 같이 막는다. stopPropagation만으로는 부족하다 — 이 캡처 리스너
          // 자체가 bubble target(버튼 등)의 핸들러를 막지만, react-router Link나
          // <button type="submit">처럼 브라우저 네이티브 동작(네비게이션/제출)까지
          // 겸하는 요소는 React 합성 이벤트 차단만으로는 막히지 않아 preventDefault를
          // 함께 건다.
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
          <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
            <X className="size-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    );
  }
);
DialogContentPanel.displayName = 'DialogContentPanel';

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  DialogContentProps
>((props, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogContentPanel ref={ref} {...props} />
  </DialogPortal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 text-center sm:text-left', className)} {...props} />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-section-title tracking-tight', className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
