import { TEXTS } from '@/shared/config/texts';
import { useIsMutating } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// shared 레이어라 entities의 postMutationKeys를 import할 수 없어 키 배열을 직접 사용한다.
// ['post', 'update']는 prefix 매칭이라 ['post', 'update', postId] 전부를 잡는다.
const CREATE_MUTATION_KEY = ['post', 'create'];
const UPDATE_MUTATION_KEY = ['post', 'update'];

export function PostMutationLoadingBadge() {
  const creatingCount = useIsMutating({ mutationKey: CREATE_MUTATION_KEY });
  const updatingCount = useIsMutating({ mutationKey: UPDATE_MUTATION_KEY });
  const isMutating = creatingCount + updatingCount;
  const [isHighlighted, setIsHighlighted] = useState(false);

  useEffect(
    function highlightWhileMutating() {
      if (isMutating) {
        setIsHighlighted(true);
        const timer = setTimeout(() => setIsHighlighted(false), 2000);
        return () => clearTimeout(timer);
      }
    },
    [isMutating]
  );

  if (!isMutating) {
    return null;
  }

  return (
    <div
      className={`flex items-center gap-1.5 rounded-full transition-all duration-500 ${
        isHighlighted
          ? 'bg-success/10 text-success px-2.5 py-1 text-sm font-medium'
          : 'text-xs text-muted-foreground px-0 py-0'
      }`}
    >
      <Loader2
        className={`animate-spin transition-all duration-500 ${isHighlighted ? 'h-4 w-4' : 'h-3.5 w-3.5'}`}
      />
      <span>{creatingCount > 0 ? TEXTS.common.submitting : TEXTS.common.updating}</span>
    </div>
  );
}
