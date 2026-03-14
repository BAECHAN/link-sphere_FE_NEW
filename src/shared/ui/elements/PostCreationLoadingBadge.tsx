import { useIsMutating } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export function PostCreationLoadingBadge() {
  const isMutating = useIsMutating({ mutationKey: ['post', 'create'] });
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(() => {
    if (isMutating) {
      setIsHighlighted(true);
      const timer = setTimeout(() => setIsHighlighted(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isMutating]);

  if (!isMutating) return null;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full transition-all duration-500 ${
        isHighlighted
          ? 'bg-lime-100 text-lime-600 dark:bg-lime-900/30 dark:text-lime-400 px-2.5 py-1 text-sm font-medium'
          : 'text-xs text-muted-foreground px-0 py-0'
      }`}
    >
      <Loader2
        className={`animate-spin transition-all duration-500 ${isHighlighted ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
      />
      <span>저장 중...</span>
    </div>
  );
}
