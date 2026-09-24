import { useEffect, useRef } from 'react';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';

/**
 * 모달·팝오버 등이 열린 직후 짧은 시간 안의 클릭을 "무의식적인 중복 클릭/탭이 새로
 * 뜬 콘텐츠에 떨어진 것"으로 보고 무시하는 가드 훅. useClickGuard와 달리 시계는
 * 가드 함수 자신의 마지막 통과 시점이 아니라 `open`이 true가 된 시점에서 시작한다 —
 * 트리거를 더블클릭/더블탭하면 두 번째 클릭이 방금 뜬 모달 위(행·버튼 등 서로 다른
 * 여러 요소)에 떨어지는 문제를 막기 위함이다(폴더 선택 모달 오탭 방지, 2026-09-24).
 *
 * @param open - 가드 대상 UI의 열림 상태
 * @param thresholdMs - open이 true가 된 뒤 이 시간(ms) 이내의 클릭은 무시한다
 *   (기본값 DOUBLE_CLICK_GUARD_MS)
 * @returns 지금이 열린 뒤 임계값 이내인지 확인하는 함수
 */
export function useOpenClickGuard(open: boolean, thresholdMs: number = DOUBLE_CLICK_GUARD_MS) {
  const openedAtRef = useRef(0);

  useEffect(() => {
    if (open) {
      openedAtRef.current = Date.now();
    }
  }, [open]);

  return () => Date.now() - openedAtRef.current < thresholdMs;
}
