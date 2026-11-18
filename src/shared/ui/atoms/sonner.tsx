import * as React from 'react';

import { Branch as DismissableLayerBranch } from '@radix-ui/react-dismissable-layer';
import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

// 종류별 토스트 색(richColors)을 sonner 고정 색 대신 globals.css 토큰에서 만든다 - 토큰을 바꾸면 토스트도 따라 바뀐다.
// 배경·테두리는 토큰을 바탕색에 옅게 섞고, 글자(제목·아이콘·닫기 X)는 토큰에 본문색을 섞어 옅은 배경 위에서도
// 대비 4.5:1을 넘긴다. sonner가 문서화하지 않은 변수 이름이라 sonner를 올리면 색을 다시 확인한다
// (docs/DESIGN-SYSTEM.md §8, docs/DECISIONS.md 2026-11-18 "토스트 색")
const KIND_TOKENS = {
  error: 'destructive',
  success: 'success',
  warning: 'warning',
  info: 'info',
} as const;

const KIND_COLOR_VARS = Object.fromEntries(
  Object.entries(KIND_TOKENS).flatMap(([kind, token]) => [
    [`--${kind}-bg`, `color-mix(in oklab, var(--${token}) 8%, var(--background))`],
    [`--${kind}-border`, `color-mix(in oklab, var(--${token}) 30%, var(--background))`],
    [`--${kind}-text`, `color-mix(in oklab, var(--${token}) 60%, var(--foreground))`],
  ])
) as React.CSSProperties;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  // Radix 모달·확인창·메뉴는 열려 있는 동안 body에 pointer-events: none을 걸어, Radix 밖인 sonner 토스트는 모달 위에
  // 보이면서도 눌리지 않았다. pointer-events-auto로 되살리고, Branch로 등록해 토스트 안 클릭·포커스가 "모달 바깥"으로
  // 잡혀 모달이 닫히지 않게 한다 - Radix 자체 Toast의 viewport와 같은 장치다(docs/DECISIONS.md 2026-11-17)
  return (
    <DismissableLayerBranch>
      <Sonner
        theme={theme as ToasterProps['theme']}
        className="toaster group pointer-events-auto"
        position="top-center"
        richColors
        closeButton
        offset={{ bottom: 'var(--toast-offset-bottom)' }}
        mobileOffset={{ bottom: 'var(--toast-offset-bottom)' }}
        // sonner CSS가 layer 밖에서 [data-sonner-toaster]에 시스템 글꼴을 직접 지정해 body의 Pretendard 상속을
        // 끊는다 — @layer utilities 안인 `font-sans` 클래스로는 못 이겨 인라인 스타일로 상속을 되살린다.
        // 종류별 색 변수도 같은 이유로 여기서 덮는다
        style={{ fontFamily: 'inherit', ...KIND_COLOR_VARS }}
        toastOptions={{
          classNames: {
            toast:
              'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg flex items-center gap-2',
            // 래퍼(shared/lib/toast/toast.ts)가 문장 끝에 넣은 줄바꿈을 그대로 보여준다
            title: 'whitespace-pre-line',
            description: 'group-[.toast]:text-muted-foreground',
            actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
            cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
            closeButton:
              'group-[.toast]:!relative group-[.toast]:!left-auto group-[.toast]:!top-auto group-[.toast]:!transform-none group-[.toast]:ml-auto group-[.toast]:order-last group-[.toast]:static group-[.toast]:border-none group-[.toast]:bg-transparent group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground',
          },
        }}
        {...props}
      />
    </DismissableLayerBranch>
  );
};

export { Toaster };
