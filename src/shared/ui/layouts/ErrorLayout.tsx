import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { TEXTS } from '@/shared/config/texts';
import { Button } from '@/shared/ui/atoms/button';

export interface ErrorLayoutProps {
  title: string;
  description?: string;
  children?: ReactNode;
  /**
   * 홈 버튼을 링크(`<a href>`)로 렌더한다. 라우터 안에서 뜨는 화면은 이걸 쓴다 -
   * 이동은 버튼 onClick이 아니라 링크로 둔다(https://www.w3.org/WAI/ARIA/apg/patterns/link/
   * - 네이티브 <a href> 권장).
   */
  homeTo?: string;
  /**
   * 라우터 밖에서도 뜨는 화면(`AppErrorFallback`)처럼 `Link`를 쓸 수 없을 때만 쓴다.
   * `homeTo`가 있으면 무시된다.
   */
  onHomeClick?: () => void;
}

export function ErrorLayout({
  title,
  description,
  children,
  homeTo,
  onHomeClick,
}: ErrorLayoutProps) {
  return (
    <div
      aria-label={TEXTS.ariaLabels.errorLayout}
      className="min-h-screen flex items-center justify-center bg-background p-4"
    >
      <div aria-label={TEXTS.ariaLabels.errorContent} className="w-full max-w-480 text-center">
        <h1 className="text-display-title text-foreground mb-4">{title}</h1>
        {description && <p className="text-xl text-muted-foreground mb-8">{description}</p>}
        {children && <div aria-label={TEXTS.ariaLabels.errorDetail}>{children}</div>}
        {renderHomeAction(homeTo, onHomeClick)}
      </div>
    </div>
  );
}

function renderHomeAction(homeTo: string | undefined, onHomeClick: (() => void) | undefined) {
  if (homeTo) {
    return (
      <Button asChild>
        <Link to={homeTo}>{TEXTS.buttons.home}</Link>
      </Button>
    );
  }

  if (onHomeClick) {
    return <Button onClick={onHomeClick}>{TEXTS.buttons.home}</Button>;
  }

  return null;
}
