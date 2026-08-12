import { TEXTS } from '@/shared/config/texts';
import { LOADING_INDICATOR_MIN_DURATION_MS } from '@/shared/config/const';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { toast } from '@/shared/lib/toast/toast';
import { useIsMutating } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

// shared 레이어라 entities의 postMutationKeys/authMutationKeys를 import할 수 없어 키 배열을 직접 사용한다.
// ['post', 'update']는 prefix 매칭이라 ['post', 'update', postId] 전부를 잡는다.
const CREATE_MUTATION_KEY = ['post', 'create'];
const UPDATE_MUTATION_KEY = ['post', 'update'];
const ACCOUNT_MUTATION_KEY = ['auth', 'updateAccount'];

// 등록/수정 화면과 목록 화면은 라우터 레이아웃 그룹이 갈려 있다. 이 컴포넌트는 App.tsx
// 최상단에 마운트되어 화면 전환에도 리마운트되지 않으므로, 아래 지연은 mutation 시작
// 시점 기준으로 정확히 흐른다.
// 완료 토스트(성공/실패)보다 여유를 둔다 - 흔한 요청 속도(약 300~500ms)의 경계값이라 너무
// 짧으면 목록 도착 직후 잠깐 떴다 사라지는 게 부자연스러워 보였다. 500ms로 늘려 그 구간의
// 요청은 진행 토스트 없이 완료 토스트만으로 확인시킨다.
const BADGE_DELAY_MS = 500;

const TOAST_ID = 'post-mutation-progress';

/**
 * 게시글 등록/수정, 계정 수정 진행 상태를 하단 토스트로 알린다.
 * 화면에 직접 마크업을 그리지 않는 헤드리스 컴포넌트 - 완료 토스트(`toast.success`)와
 * 같은 자리(하단)에서 진행→완료가 이어지도록 토스트로 발행한다.
 */
export function PostMutationLoadingToast() {
  const creatingCount = useIsMutating({ mutationKey: CREATE_MUTATION_KEY });
  const updatingCount = useIsMutating({ mutationKey: UPDATE_MUTATION_KEY });
  const accountUpdatingCount = useIsMutating({ mutationKey: ACCOUNT_MUTATION_KEY });
  const isMutatingNow = creatingCount + updatingCount + accountUpdatingCount > 0;
  // 빠른 요청은 완료 토스트가 확인해주므로 표시하지 않고(지연), 지연을 넘겨 한 번 뜨면
  // 최소 시간은 유지한다(깜빡임 방지) - 반짝 켜졌다 꺼지는 모양을 없앤다.
  const isMutatingDelayed = useDelayedLoading(isMutatingNow, BADGE_DELAY_MS);
  const showToast = useMinimumLoading(isMutatingDelayed, LOADING_INDICATOR_MIN_DURATION_MS);

  // creatingCount는 최소 노출 구간 막바지에 이미 0으로 떨어질 수 있어, 매 렌더 실시간으로
  // 읽으면 진행 토스트가 사라지기 직전 '수정 중...'으로 뒤바뀐다. 진행 중인 동안의 라벨을 고정해 둔다.
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
    function syncProgressToast() {
      if (showToast) {
        toast.loading(latchedLabel, { id: TOAST_ID, duration: Infinity });
      } else {
        toast.dismiss(TOAST_ID);
      }
    },
    [showToast, latchedLabel]
  );

  useEffect(function dismissProgressToastOnUnmount() {
    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, []);

  return null;
}
