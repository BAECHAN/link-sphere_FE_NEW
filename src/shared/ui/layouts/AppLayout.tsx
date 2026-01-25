import { ReactNode } from 'react';

import { TEXTS } from '@/shared/config/texts';
import { Navbar } from '@/shared/ui/widgets/Navbar';
import { ScrollToTop } from '@/shared/ui/elements/ScrollToTop';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: Readonly<AppLayoutProps>) {
  return (
    <div aria-label={TEXTS.ariaLabels.appLayout}>
      <Navbar />
      <main
        className="container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 h-[4000px]"
        aria-label={TEXTS.ariaLabels.mainContent}
      >
        {children}
      </main>
      <ScrollToTop />
    </div>
  );
}
