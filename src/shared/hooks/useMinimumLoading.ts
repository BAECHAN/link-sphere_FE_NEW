import { useEffect, useState } from 'react';

/**
 * 최소 로딩 시간 보장 훅
 *
 * 로딩이 시작되면 최소 minDuration 만큼은 로딩 상태를 true로 유지합니다.
 * 실제 로딩이 그보다 빨리 끝나도 minDuration까지 기다렸다가 false가 됩니다.
 *
 * @param isLoading 실제 로딩 상태
 * @param minDuration 최소 유지 시간 (ms, 기본값 1000ms)
 * @param isError 에러 상태
 * @returns 최소 시간이 보장된 로딩 상태 (isError면 즉시 false)
 */
export function useMinimumLoading(
  isLoading: boolean,
  minDuration: number = 1000,
  isError: boolean = false
) {
  // 로딩이 시작될 때마다 1씩 늘리는 회차 - 최소 시간 타이머를 회차 단위로 건다
  const [loadingRound, setLoadingRound] = useState(isLoading ? 1 : 0);
  const [prevIsLoading, setPrevIsLoading] = useState(isLoading);
  // 최소 시간이 지난 마지막 회차
  const [settledRound, setSettledRound] = useState(0);

  // 로딩 시작을 렌더 중에 감지한다 - effect에서 하면 로딩이 꺼진 채로 한 번 더 렌더된다
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (isLoading !== prevIsLoading) {
    setPrevIsLoading(isLoading);

    if (isLoading) {
      setLoadingRound((round) => round + 1);
    }
  }

  useEffect(() => {
    if (loadingRound === 0) {
      return;
    }

    // 로딩이 끝나도 이 타이머는 그대로 둔다 - 시작 시점부터 minDuration을 채워야 하므로
    // 다음 회차가 시작되거나 언마운트될 때만 정리한다
    const timer = setTimeout(() => {
      setSettledRound(loadingRound);
    }, minDuration);

    return () => {
      clearTimeout(timer);
    };
  }, [loadingRound, minDuration]);

  const isMinDurationPending = loadingRound !== settledRound;

  // 에러가 나면 최소 유지 시간을 무시하고 즉시 끝낸다
  if (isError) {
    return false;
  }

  return isLoading || isMinDurationPending;
}
