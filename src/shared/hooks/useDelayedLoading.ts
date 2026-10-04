import { useEffect, useState } from 'react';

/**
 * 로딩 상태를 지연시켜서 보여주는 훅
 * 짧은 로딩 시간 동안에는 로딩 인디케이터를 보여주지 않아 깜빡임을 방지합니다.
 *
 * @param isLoading 실제 로딩 상태
 * @param delay 지연 시간 (ms) - 기본값 300ms
 * @returns 지연된 로딩 상태
 */
export function useDelayedLoading(isLoading: boolean, delay: number = 300) {
  const [showLoading, setShowLoading] = useState(false);

  // 로딩이 끝나면 즉시 showLoading을 false로 설정 - effect에서 끄면 낡은 true로 한 번 더
  // 렌더된다(https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (!isLoading && showLoading) {
    setShowLoading(false);
  }

  useEffect(() => {
    if (!isLoading) {
      return;
    }

    // 로딩이 시작되면 delay만큼 기다렸다가 showLoading을 true로 설정
    const timer = setTimeout(() => {
      setShowLoading(true);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [isLoading, delay]);

  return showLoading;
}
