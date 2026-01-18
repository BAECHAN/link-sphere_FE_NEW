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
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg flex items-center gap-2',
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
