import { ReactNode } from 'react';

import { TEXTS } from '@/shared/config/texts';

interface ErrorLayoutProps {
  title: string;
  description?: string;
  children?: ReactNode;
  onHomeClick?: () => void;
}

export function ErrorLayout({ title, description, children, onHomeClick }: ErrorLayoutProps) {
  return (
    <div aria-label={TEXTS.ariaLabels.errorLayout}>
      <div aria-label={TEXTS.ariaLabels.errorContent}>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
        {children && <div aria-label={TEXTS.ariaLabels.errorDetail}>{children}</div>}
        {onHomeClick ? <button onClick={onHomeClick}>홈으로 이동</button> : null}
      </div>
    </div>
  );
}
