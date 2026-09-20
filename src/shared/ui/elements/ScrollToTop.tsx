'use client';

import { useState, useEffect, useRef } from 'react';
import { ArrowUp } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';

// framer-motion의 AnimatePresence와 같은 fade+scale+slide 지속시간(ms) - exit
// 애니메이션이 끝날 때까지 마운트를 유지하려면 CSS transition 시간과 정확히 맞아야 한다.
const TRANSITION_MS = 200;

export function ScrollToTop() {
  const [isVisible, setIsVisible] = useState(false);
  // isVisible이 false가 된 뒤에도 exit 애니메이션이 끝날 때까지 DOM에 남겨둔다.
  const [shouldRender, setShouldRender] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const toggleVisibility = () => {
      setIsVisible(window.scrollY > 300);
    };

    window.addEventListener('scroll', toggleVisibility);
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  useEffect(() => {
    if (isVisible) {
      clearTimeout(hideTimeoutRef.current);
      setShouldRender(true);
      return;
    }

    hideTimeoutRef.current = setTimeout(() => setShouldRender(false), TRANSITION_MS);
    return () => clearTimeout(hideTimeoutRef.current);
  }, [isVisible]);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (!shouldRender) {
    return null;
  }

  return (
    <div
      className={cn(
        'fixed bottom-20 right-6 z-nav md:bottom-6 transition-all duration-200',
        isVisible ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-[0.8] translate-y-5'
      )}
    >
      <Button
        size="icon"
        onClick={scrollToTop}
        className="rounded-full h-12 w-12 shadow-lg bg-primary hover:bg-primary/90 transition-all active:scale-95"
        aria-label="Scroll to top"
      >
        <ArrowUp className="h-6 w-6" />
      </Button>
    </div>
  );
}
