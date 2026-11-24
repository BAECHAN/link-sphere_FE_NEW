import { ReactNode } from 'react';

import { useUiTexts } from '@baechan/ui/texts/UiTextsProvider';

export interface ErrorLayoutProps {
  title: string;
  description?: string;
  children?: ReactNode;
  /**
   * 설명 아래에 그릴 동작(홈으로 가는 버튼 등). 어디로 어떻게 이동할지는 쓰는 쪽이 정한다 -
   * 이 부품은 라우터를 import하지 않는다. 이동은 버튼 onClick이 아니라 링크로 넘긴다
   * (https://www.w3.org/WAI/ARIA/apg/patterns/link/ - 네이티브 <a href> 권장). 라우터 밖에서도
   * 뜨는 화면(`AppErrorFallback`)처럼 링크를 쓸 수 없을 때만 onClick 버튼을 넘긴다.
   */
  homeAction?: ReactNode;
}

export function ErrorLayout({ title, description, children, homeAction }: ErrorLayoutProps) {
  const uiTexts = useUiTexts();

  return (
    <div
      aria-label={uiTexts.errorLayout.root}
      className="min-h-screen flex items-center justify-center bg-background p-4"
    >
      <div aria-label={uiTexts.errorLayout.content} className="w-full max-w-480 text-center">
        <h1 className="text-display-title text-foreground mb-4">{title}</h1>
        {description && <p className="text-xl text-muted-foreground mb-8">{description}</p>}
        {children && <div aria-label={uiTexts.errorLayout.detail}>{children}</div>}
        {homeAction}
      </div>
    </div>
  );
}
