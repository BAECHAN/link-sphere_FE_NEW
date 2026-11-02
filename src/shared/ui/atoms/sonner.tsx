import * as React from 'react';

import { useTheme } from 'next-themes';
import { Toaster as Sonner } from 'sonner';

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      className="toaster group"
      position="top-center"
      richColors
      closeButton
      offset={{ bottom: 'var(--toast-offset-bottom)' }}
      mobileOffset={{ bottom: 'var(--toast-offset-bottom)' }}
      // sonner CSS가 layer 밖에서 [data-sonner-toaster]에 시스템 글꼴을 직접 지정해 body의 Pretendard 상속을
      // 끊는다 — @layer utilities 안인 `font-sans` 클래스로는 못 이겨 인라인 스타일로 상속을 되살린다
      style={{ fontFamily: 'inherit' }}
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
  );
};

export { Toaster };
