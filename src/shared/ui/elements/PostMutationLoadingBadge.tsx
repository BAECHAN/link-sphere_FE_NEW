import { TEXTS } from '@/shared/config/texts';
import { LOADING_INDICATOR_MIN_DURATION_MS } from '@/shared/config/const';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { useIsMutating } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

// shared 레이어라 entities의 postMutationKeys/authMutationKeys를 import할 수 없어 키 배열을 직접 사용한다.
// ['post', 'update']는 prefix 매칭이라 ['post', 'update', postId] 전부를 잡는다.
const CREATE_MUTATION_KEY = ['post', 'create'];
const UPDATE_MUTATION_KEY = ['post', 'update'];
const ACCOUNT_MUTATION_KEY = ['auth', 'updateAccount'];

// 카드 오버레이(LOADING_INDICATOR_DELAY_MS=300ms)보다 여유를 둔다 - 등록/수정 화면과
// 목록 화면은 라우터 레이아웃 그룹이 갈려 화면 전환마다 이 배지가 리마운트되는데, 300ms는
// 흔한 요청 속도(약 300~500ms)의 경계값이라 목록 도착 직후 잠깐 떴다 사라지는 게 부자연스러워
// 보였다. 500ms로 늘려 그 구간의 요청은 배지 없이 완료 토스트만으로 확인시킨다.
const BADGE_DELAY_MS = 500;

export function PostMutationLoadingBadge() {
  const creatingCount = useIsMutating({ mutationKey: CREATE_MUTATION_KEY });
  const updatingCount = useIsMutating({ mutationKey: UPDATE_MUTATION_KEY });
  const accountUpdatingCount = useIsMutating({ mutationKey: ACCOUNT_MUTATION_KEY });
  const isMutatingNow = creatingCount + updatingCount + accountUpdatingCount > 0;
  // 빠른 요청은 완료 토스트가 확인해주므로 표시하지 않고(지연), 지연을 넘겨 한 번 뜨면
  // 최소 시간은 유지한다(깜빡임 방지) - 반짝 켜졌다 꺼지는 모양을 없앤다.
  const isMutatingDelayed = useDelayedLoading(isMutatingNow, BADGE_DELAY_MS);
  const showBadge = useMinimumLoading(isMutatingDelayed, LOADING_INDICATOR_MIN_DURATION_MS);
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
