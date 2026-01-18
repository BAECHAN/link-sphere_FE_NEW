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

  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isLoading) {
      // 로딩이 시작되면 delay만큼 기다렸다가 showLoading을 true로 설정
      timer = setTimeout(() => {
        setShowLoading(true);
      }, delay);
    } else {
      // 로딩이 끝나면 즉시 showLoading을 false로 설정
      setShowLoading(false);
    }

    return () => {
      clearTimeout(timer);
    };
  }, [isLoading, delay]);

  return showLoading;
}
