'use client';

import * as DropdownMenuPrimitive from '@radix-ui/react-dropdown-menu';
import { Check, ChevronRight, Circle } from 'lucide-react';

import { cn } from '@/shared/lib/tailwind/utils';
import { createContext, forwardRef, useContext, useEffect, useRef, useState } from 'react';

interface DropdownMenuOpenContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
  contentRef: React.MutableRefObject<HTMLDivElement | null>;
  closedByScrollRef: React.MutableRefObject<boolean>;
}

/**
 * Radix DropdownMenuTrigger는 onPointerDown에서 즉시 열린다(누르는 순간, 떼기 전) —
 * WCAG 2.2 SC 2.5.2(Pointer Cancellation) 위반이자, 트리거를 누른 채 손이 몇 px만
 * 움직여도 이미 열린 메뉴의 첫 항목 위에서 pointerup이 발생해 그 항목이 강제로
 * 클릭되는 press-drag-release 오발동의 원인이다(docs/DECISIONS.md 참고). 이 open 상태를
 * 우리가 직접 들고 Root에 controlled로 넘겨, Trigger가 click(=pointerup 후)에서만 열게
 * 한다.
 */
const DropdownMenuOpenContext = createContext<DropdownMenuOpenContextValue | null>(null);

/**
 * modal 기본값을 Radix와 반대로 false로 둔다 — modal이면 react-remove-scroll이 걸려 메뉴가
 * 열린 동안 페이지 스크롤이 잠긴다. 대신 스크롤하면 메뉴를 닫고, 바깥 클릭은
 * DropdownMenuContent의 오버레이가 흡수한다(docs/DECISIONS.md 2026-09-24).
 */
const DropdownMenu = ({
  open: openProp,
  defaultOpen,
  onOpenChange,
  modal = false,
  ...props
}: React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Root>) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen ?? false);
  const open = openProp ?? uncontrolledOpen;
  const contentRef = useRef<HTMLDivElement | null>(null);
  const closedByScrollRef = useRef(false);

  const setOpen = (next: boolean) => {
    if (openProp === undefined) {
      setUncontrolledOpen(next);
    }

    onOpenChange?.(next);
  };

  const setOpenRef = useRef(setOpen);
  setOpenRef.current = setOpen;

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleScroll = (event: Event) => {
      // 메뉴 자신이 overflow-y-auto라 긴 메뉴의 내부 스크롤로는 닫지 않는다.
      if (event.target instanceof Node && contentRef.current?.contains(event.target)) {
        return;
      }

      closedByScrollRef.current = true;
      setOpenRef.current(false);
    };

    document.addEventListener('scroll', handleScroll, { capture: true, passive: true });

    return () => {
      document.removeEventListener('scroll', handleScroll, { capture: true });
    };
  }, [open]);

  return (
    <DropdownMenuOpenContext.Provider value={{ open, setOpen, contentRef, closedByScrollRef }}>
      <DropdownMenuPrimitive.Root {...props} modal={modal} open={open} onOpenChange={setOpen} />
    </DropdownMenuOpenContext.Provider>
  );
};

const DropdownMenuTrigger = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Trigger>
>(({ onPointerDown, onClick, ...props }, ref) => {
  const openContext = useContext(DropdownMenuOpenContext);

  return (
    <DropdownMenuPrimitive.Trigger
      ref={ref}
      {...props}
      onPointerDown={(event) => {
        onPointerDown?.(event);
        // Radix 내부 onPointerDown 열기 핸들러를 항상 막는다 — click에서만 연다.
        event.preventDefault();
      }}
      onClick={(event) => {
        onClick?.(event);

        if (!event.defaultPrevented) {
          openContext?.setOpen(!openContext.open);
        }
      }}
    />
  );
});
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;

const DropdownMenuGroup = DropdownMenuPrimitive.Group;

const DropdownMenuPortal = DropdownMenuPrimitive.Portal;

const DropdownMenuSub = DropdownMenuPrimitive.Sub;

const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
>(({ className, inset, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    data-slot="dropdown-menu-sub-trigger"
    data-inset={inset}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground [&_svg:not([class*='text-'])]:text-muted-foreground flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  >
    {children}
    <ChevronRight className="size-4 ml-auto" />
  </DropdownMenuPrimitive.SubTrigger>
));
DropdownMenuSubTrigger.displayName = DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.SubContent
    ref={ref}
    data-slot="dropdown-menu-sub-content"
    className={cn(
      'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-popover min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-hidden rounded-md border p-1 shadow-lg',
      className
    )}
    {...props}
  />
));
DropdownMenuSubContent.displayName = DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 4, onCloseAutoFocus, ...props }, ref) => {
  const openContext = useContext(DropdownMenuOpenContext);

  return (
    <>
      {/* 바깥 첫 클릭은 메뉴만 닫고 아래 요소(게시글 카드 등)로 전달하지 않는다. pointerdown을
          Radix의 document 리스너까지 보내면 그 자리에서 메뉴·오버레이가 사라져 뒤이은 click이
          아래 요소로 떨어지므로, 여기서 멈추고 오버레이 자신의 click에서 닫는다.
          Portal은 asChild(Slot)라 자식을 하나만 받으므로 Content와 별도 Portal에 둔다. */}
      <DropdownMenuPrimitive.Portal>
        <div
          aria-hidden="true"
          className="fixed inset-0 z-popover"
          onPointerDown={(event) => {
            event.stopPropagation();
            event.preventDefault();
          }}
          onClick={() => openContext?.setOpen(false)}
        />
      </DropdownMenuPrimitive.Portal>
      <DropdownMenuPrimitive.Portal>
        <DropdownMenuPrimitive.Content
          ref={(node) => {
            if (openContext) {
              openContext.contentRef.current = node;
            }

            if (typeof ref === 'function') {
              ref(node);
            } else if (ref) {
              (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
            }
          }}
          data-slot="dropdown-menu-content"
          sideOffset={sideOffset}
          className={cn(
            'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-popover max-h-(--radix-dropdown-menu-content-available-height) min-w-[8rem] origin-(--radix-dropdown-menu-content-transform-origin) overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-md',
            className
          )}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);

            // 스크롤로 닫혔을 때 트리거로 포커스를 돌리면 focus()가 트리거 위치로 스크롤을 되돌린다.
            if (openContext?.closedByScrollRef.current) {
              openContext.closedByScrollRef.current = false;
              event.preventDefault();
            }
          }}
          {...props}
        />
      </DropdownMenuPrimitive.Portal>
    </>
  );
});
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
    variant?: 'default' | 'secondary' | 'destructive' | 'ghost' | 'link';
  }
>(({ className, inset, variant = 'default', ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    data-slot="dropdown-menu-item"
    data-inset={inset}
    data-variant={variant}
    className={cn(
      "focus:bg-accent focus:text-accent-foreground data-[variant=destructive]:text-destructive data-[variant=destructive]:focus:bg-destructive/10 dark:data-[variant=destructive]:focus:bg-destructive/20 data-[variant=destructive]:focus:text-destructive data-[variant=destructive]:*:[svg]:!text-destructive [&_svg:not([class*='text-'])]:text-muted-foreground relative flex items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[inset]:pl-8 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  />
));
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.CheckboxItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.CheckboxItem>
>(({ className, children, checked, ...props }, ref) => (
  <DropdownMenuPrimitive.CheckboxItem
    ref={ref}
    data-slot="dropdown-menu-checkbox-item"
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    checked={checked}
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Check className="size-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
));
DropdownMenuCheckboxItem.displayName = DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.RadioItem>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.RadioItem>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.RadioItem
    ref={ref}
    data-slot="dropdown-menu-radio-item"
    className={cn(
      "focus:bg-accent focus:text-accent-foreground relative flex items-center gap-2 rounded-sm py-1.5 pr-2 pl-8 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
      className
    )}
    {...props}
  >
    <span className="pointer-events-none absolute left-2 flex size-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <Circle className="size-2 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
));
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
>(({ className, inset, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    data-slot="dropdown-menu-label"
    data-inset={inset}
    className={cn('px-2 py-1.5 text-sm font-medium data-[inset]:pl-8', className)}
    {...props}
  />
));
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator = forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    data-slot="dropdown-menu-separator"
    className={cn('bg-border -mx-1 my-1 h-px', className)}
    {...props}
  />
));
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & {
  children: React.ReactNode;
} & React.RefAttributes<HTMLSpanElement>) => {
  return (
    <span
      data-slot="dropdown-menu-shortcut"
      className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
