import { ReactNode } from 'react';

import { TEXTS } from '@/shared/config/texts';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: Readonly<AppLayoutProps>) {
  return (
    <div aria-label={TEXTS.ariaLabels.appLayout}>
      <div>Header</div>
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
