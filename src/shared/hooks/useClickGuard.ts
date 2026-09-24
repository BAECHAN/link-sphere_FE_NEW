import { useCallback, useRef } from 'react';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

/**
 * 무의식적 중복과 의식적 재입력을 가르는 기준 시간(ms). 근거는 아래 useClickGuard 주석 참고.
 * @deprecated `@/shared/config/const`의 `DOUBLE_CLICK_GUARD_MS`를 직접 쓴다 — 이 export는
 * 그 값을 그대로 가리키기만 한다(select.tsx 등 기존 호출부 하위 호환용, 2026-09-24 병합 시
 * 같은 상수가 두 곳에 따로 생긴 걸 발견해 SSOT로 정리).
 */
export const CLICK_GUARD_MS = DOUBLE_CLICK_GUARD_MS;

/**
 * 짧은 시간 안의 재클릭을 "무의식적인 중복 클릭"으로 보고 무시하는 가드 훅. 토글
 * 버튼은 짝수 번 눌리면 원래 상태로 되돌아가 "눌렀는데 반영 안 됨"처럼 보이는데,
 * 그중 사용자가 결과를 인지하고 의도적으로 다시 누른 게 아니라 무의식적으로
 * 두 번 눌린 경우만 걸러낸다.
 *
 * Windows의 더블클릭 속도 기본값(500ms)이 정확히 이 구분("하나의 제스처로 볼지,
 * 별개의 의도적인 두 동작으로 볼지")에 쓰이는 값이다 — _"the default timing in
 * Windows is 500 ms (half a second)"_ ([Wikipedia, Double-click](https://en.wikipedia.org/wiki/Double-click),
 * Microsoft MSDN 인용). 사람의 단순 시각 반응시간은 평균 200~273ms
 * ([관련 리서치 종합](https://www.orangeneurosciences.ca/guide/reaction-time-average))
 * 이라 400ms도 "결과를 보고 판단해서 다시 누르기로 결정"하는 데 걸리는 시간보다
 * 충분히 크면서, 500ms보다는 응답성이 좋다(2026-09-21 재조정, docs/DECISIONS.md 참고).
 *
 * @param thresholdMs - 이 시간(ms) 이내의 재호출은 무시한다 (기본값 DOUBLE_CLICK_GUARD_MS)
 * @returns 호출 시점이 임계값을 넘었으면 true(진행), 아니면 false(무시)
 */
export function useClickGuard(thresholdMs: number = DOUBLE_CLICK_GUARD_MS) {
  const lastCallRef = useRef(0);

  return useCallback(() => {
    const now = Date.now();

    if (now - lastCallRef.current < thresholdMs) {
      return false;
    }

    lastCallRef.current = now;
    return true;
  }, [thresholdMs]);
}
