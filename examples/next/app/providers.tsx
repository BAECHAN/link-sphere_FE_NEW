'use client';

// 패키지 부품이 위쪽에 요구하는 것을 한곳에 모은 클라이언트 경계다. 패키지 파일에는 'use client'가 없어서
// (docs/DESIGN-SYSTEM-PRINCIPLES.md §1.5), 훅을 쓰는 부품은 이런 경계 아래에서만 그릴 수 있다
import type { ReactNode } from 'react';
import { ThemeProvider } from 'next-themes';

import { Toaster } from '@baechan/ui/atoms/sonner';
import { TooltipProvider } from '@baechan/ui/atoms/tooltip';
import { KO_UI_TEXTS } from '@baechan/ui/texts/ko-ui-texts';
import { UiTextsProvider } from '@baechan/ui/texts/UiTextsProvider';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <UiTextsProvider texts={KO_UI_TEXTS}>
        <TooltipProvider>
          {children}
          <Toaster />
        </TooltipProvider>
      </UiTextsProvider>
    </ThemeProvider>
  );
}
