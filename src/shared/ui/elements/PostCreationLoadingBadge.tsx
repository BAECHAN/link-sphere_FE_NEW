import { useIsMutating } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';

export function PostCreationLoadingBadge() {
  const isMutating = useIsMutating({ mutationKey: ['post', 'create'] });
  if (!isMutating) return null;

  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
      <span>저장 중...</span>
    </div>
  );
}
