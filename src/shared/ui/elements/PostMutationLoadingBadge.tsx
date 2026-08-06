import { TEXTS } from '@/shared/config/texts';
import { LOADING_INDICATOR_MIN_DURATION_MS } from '@/shared/config/const';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { useIsMutating } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// shared 레이어라 entities의 postMutationKeys/authMutationKeys를 import할 수 없어 키 배열을 직접 사용한다.
// ['post', 'update']는 prefix 매칭이라 ['post', 'update', postId] 전부를 잡는다.
const CREATE_MUTATION_KEY = ['post', 'create'];
const UPDATE_MUTATION_KEY = ['post', 'update'];
const ACCOUNT_MUTATION_KEY = ['auth', 'updateAccount'];

export function PostMutationLoadingBadge() {
  const creatingCount = useIsMutating({ mutationKey: CREATE_MUTATION_KEY });
  const updatingCount = useIsMutating({ mutationKey: UPDATE_MUTATION_KEY });
  const accountUpdatingCount = useIsMutating({ mutationKey: ACCOUNT_MUTATION_KEY });
  const isMutatingNow = creatingCount + updatingCount + accountUpdatingCount > 0;
  // API가 순식간에 끝나 배지가 뜨자마자 사라지는 깜빡임을 막기 위해 최소 노출 시간을 보장한다.
  const showBadge = useMinimumLoading(isMutatingNow, LOADING_INDICATOR_MIN_DURATION_MS);
  const [isHighlighted, setIsHighlighted] = useState(false);

  // creatingCount는 최소 노출 구간 막바지에 이미 0으로 떨어질 수 있어, 매 렌더 실시간으로
  // 읽으면 등록 배지가 사라지기 직전 '수정 중...'으로 뒤바뀐다. 진행 중인 동안의 라벨을 고정해 둔다.
  const [latchedLabel, setLatchedLabel] = useState<string>(TEXTS.common.submitting);

  useEffect(
    function latchLabelWhileMutating() {
      if (isMutatingNow) {
        setLatchedLabel(creatingCount > 0 ? TEXTS.common.submitting : TEXTS.common.updating);
      }
    },
    [isMutatingNow, creatingCount]
  );

  useEffect(
    function highlightWhileMutating() {
      if (showBadge) {
        setIsHighlighted(true);
        const timer = setTimeout(() => setIsHighlighted(false), 2000);
        return () => clearTimeout(timer);
      }
    },
    [showBadge]
  );

  if (!showBadge) {
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
      <span>{latchedLabel}</span>
    </div>
  );
}
