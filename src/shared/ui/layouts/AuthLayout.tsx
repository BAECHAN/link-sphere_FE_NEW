import { ReactNode } from 'react';
import { TEXTS } from '@/shared/config/texts';

interface AuthLayoutProps {
  children: ReactNode;
}

export function AuthLayout({ children }: Readonly<AuthLayoutProps>) {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gray-50 p-4"
      aria-label={TEXTS.ariaLabels.authLayout}
    >
      <div className="w-full max-w-480" aria-label={TEXTS.ariaLabels.authContent}>
        {children}
      </div>
    </div>
  );
}
