import { ReactNode } from 'react';

import { TEXTS } from '@/shared/config/texts';
import { Navbar } from '@/shared/ui/widgets/Navbar';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: Readonly<AppLayoutProps>) {
  return (
    <div aria-label={TEXTS.ariaLabels.appLayout}>
      <Navbar />
      <div aria-label={TEXTS.ariaLabels.bodyContainer}>
        <div aria-label={TEXTS.ariaLabels.sidebarWrapper}>
          <div>Sidebar</div>
        </div>
        <div aria-label={TEXTS.ariaLabels.contentArea}>
          <div aria-label={TEXTS.ariaLabels.mainContent}>{children}</div>
          <div>Footer</div>
        </div>
      </div>
    </div>
  );
}
