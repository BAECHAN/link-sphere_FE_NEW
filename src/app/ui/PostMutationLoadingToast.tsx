import { TEXTS } from '@/shared/config/texts';
import {
  MUTATION_PROGRESS_DELAY_MS,
  LOADING_INDICATOR_MIN_DURATION_MS,
} from '@/shared/config/const';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { toast } from '@/shared/lib/toast/toast';
import { accountMutationKeys } from '@/entities/account/api/account.keys';
import { useIsMutating } from '@tanstack/react-query';
import { useEffect } from 'react';

// 이 컴포넌트는 App.tsx 최상단에 마운트되어 화면 전환에도 리마운트되지 않으므로, 아래
// 지연은 mutation 시작 시점 기준으로 정확히 흐른다.
// 지연 근거(MUTATION_PROGRESS_DELAY_MS)는 shared/config/const.ts에 있다 - 완료 토스트보다
// 여유를 둬서, 흔한 요청 속도(약 300~500ms) 구간은 진행 토스트 없이 완료 토스트만으로
// 확인시킨다.
//
// 게시글 등록·수정은 2026-10-03부터 폼에서 응답을 기다리며 버튼 라벨("등록 중..."/
// "수정 중...")로 진행을 보여주므로 여기서 감시하지 않는다 - 이 토스트까지 띄우면 같은
// 진행 상태가 두 군데에 겹친다(docs/DECISIONS.md 2026-10-03 항목).

const TOAST_ID = 'post-mutation-progress';

/**
 * 계정 수정 진행 상태를 하단 토스트로 알린다.
 * 화면에 직접 마크업을 그리지 않는 헤드리스 컴포넌트 - 완료 토스트(`toast.success`)와
 * 같은 자리(하단)에서 진행→완료가 이어지도록 토스트로 발행한다.
 */
export function PostMutationLoadingToast() {
  const isMutatingNow = useIsMutating({ mutationKey: accountMutationKeys.update }) > 0;
  // 빠른 요청은 완료 토스트가 확인해주므로 표시하지 않고(지연), 지연을 넘겨 한 번 뜨면
  // 최소 시간은 유지한다(깜빡임 방지) - 반짝 켜졌다 꺼지는 모양을 없앤다.
  const isMutatingDelayed = useDelayedLoading(isMutatingNow, MUTATION_PROGRESS_DELAY_MS);
  const showToast = useMinimumLoading(isMutatingDelayed, LOADING_INDICATOR_MIN_DURATION_MS);

  useEffect(
    function syncProgressToast() {
      if (showToast) {
        toast.loading(TEXTS.common.updating, { id: TOAST_ID, duration: Infinity });
      } else {
        toast.dismiss(TOAST_ID);
      }
    },
    [showToast]
  );

  useEffect(function dismissProgressToastOnUnmount() {
    return () => {
      toast.dismiss(TOAST_ID);
    };
  }, []);

  return null;
}
