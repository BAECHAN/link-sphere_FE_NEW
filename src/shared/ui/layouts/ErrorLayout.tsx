import { ReactNode } from 'react';

import { TEXTS } from '@/shared/config/texts';
import { Button } from '@/shared/ui/atoms/button';

interface ErrorLayoutProps {
  title: string;
  description?: string;
  children?: ReactNode;
  onHomeClick?: () => void;
}

export function ErrorLayout({ title, description, children, onHomeClick }: ErrorLayoutProps) {
  return (
    <div
      aria-label={TEXTS.ariaLabels.errorLayout}
      className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
    >
      <div aria-label={TEXTS.ariaLabels.errorContent} className="w-full max-w-480 text-center">
        <h1 className="text-6xl font-bold text-gray-900 mb-4">{title}</h1>
        {description && <p className="text-xl text-gray-600 mb-8">{description}</p>}
        {children && <div aria-label={TEXTS.ariaLabels.errorDetail}>{children}</div>}
        {onHomeClick ? <Button onClick={onHomeClick}>{TEXTS.buttons.home}</Button> : null}
      </div>
    </div>
  );
}
