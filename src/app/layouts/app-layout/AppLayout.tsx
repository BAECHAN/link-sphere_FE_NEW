import { ReactNode } from 'react';
import { useMatch } from 'react-router-dom';
import { motion } from 'framer-motion';

import { TEXTS } from '@/shared/config/texts';
import { Navbar } from '@/widgets/layout/navbar/ui/Navbar';
import { Sidebar } from '@/widgets/layout/sidebar/ui/Sidebar';
import { ScrollToTop } from '@/shared/ui/elements/ScrollToTop';
import { useSwipeNavigation } from '@/shared/hooks/useSwipeNavigation';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: Readonly<AppLayoutProps>) {
  const isDetailPage = useMatch('/post/:id');
  const { enabled, onDragEnd } = useSwipeNavigation();

  return (
    <div aria-label={TEXTS.ariaLabels.appLayout} className="min-h-screen flex">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <main
          className="flex-1 container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-4"
          aria-label={TEXTS.ariaLabels.mainContent}
        >
          <motion.div
            drag={enabled ? 'x' : false}
            dragDirectionLock
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={onDragEnd}
          >
            {children}
          </motion.div>
        </main>
      </div>
      {!isDetailPage && <ScrollToTop />}
    </div>
  );
}
