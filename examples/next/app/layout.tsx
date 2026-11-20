import type { ReactNode } from 'react';

import { Providers } from './providers';
import './globals.css';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // next-themes가 그리기 전에 html의 class를 바꿔 서버 HTML과 달라진다 - 이 요소의 그 경고만 끈다
    <html lang="ko" suppressHydrationWarning>
      <body className="bg-background text-foreground">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
