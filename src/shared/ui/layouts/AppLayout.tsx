import { ReactNode } from 'react';
import { useMatch } from 'react-router-dom';

import { TEXTS } from '@/shared/config/texts';
import { Navbar } from '@/shared/ui/widgets/Navbar';
import { ScrollToTop } from '@/shared/ui/elements/ScrollToTop';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: Readonly<AppLayoutProps>) {
  const isDetailPage = useMatch('/post/:id');

  return (
    <div aria-label={TEXTS.ariaLabels.appLayout} className="min-h-screen flex flex-col">
      <div className="flex-1">
        <Navbar />
        <main
          className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8"
          aria-label={TEXTS.ariaLabels.mainContent}
        >
          {children}
        </main>
      </div>
      {!isDetailPage && <ScrollToTop />}
    </div>
  );
}
