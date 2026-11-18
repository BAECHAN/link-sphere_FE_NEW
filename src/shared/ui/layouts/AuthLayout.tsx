import { ReactNode } from 'react';
import { useUiTexts } from '@/shared/ui/texts/UiTextsProvider';

export interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  const uiTexts = useUiTexts();

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-background p-4"
      aria-label={uiTexts.authLayout.root}
    >
      <div className="w-full max-w-480" aria-label={uiTexts.authLayout.content}>
        {children}
      </div>
    </div>
  );
}
