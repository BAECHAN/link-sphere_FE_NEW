import { useEffect, useState, useRef, useCallback } from 'react';

/**
 * 최소 로딩 시간 보장 훅
 *
 * 로딩이 시작되면 최소 minDuration 만큼은 로딩 상태를 true로 유지합니다.
 * 실제 로딩이 그보다 빨리 끝나도 minDuration까지 기다렸다가 false가 됩니다.
 *
 * @param isLoading 실제 로딩 상태
 * @param minDuration 최소 유지 시간 (ms, 기본값 1000ms)
 * @param isError 에러 상태
 * @returns [showLoading, stopDelay]
 * - showLoading: 최소 시간이 보장된 로딩 상태
 * - stopDelay: 최소 유지 시간을 무시하고 즉시 로딩을 끝내는 함수 (예: 에러 발생 시)
 */
export function useMinimumLoading(
  isLoading: boolean,
  minDuration: number = 1000,
  isError: boolean = false
) {
  const [showLoading, setShowLoading] = useState(isLoading);
  const startTimeRef = useRef<number | null>(null);
  const timerRef = useRef<NodeJS.Timeout>();

  const stopDelay = useCallback(() => {
    setShowLoading(false);
    startTimeRef.current = null;
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = undefined;
    }
  }, []);

  useEffect(() => {
    if (isError) {
      stopDelay();
    }
  }, [isError, stopDelay]);

  useEffect(() => {
    if (isLoading) {
      // 로딩 시작 시점 기록
      startTimeRef.current = Date.now();
      setShowLoading(true);

      if (timerRef.current) clearTimeout(timerRef.current);
    } else {
      // 로딩이 끝났을 때
      if (startTimeRef.current) {
        const elapsedTime = Date.now() - startTimeRef.current;
        const remainingTime = minDuration - elapsedTime;

        if (remainingTime > 0) {
          // 최소 시간이 아직 안 지났으면 남은 시간만큼 기다림
          timerRef.current = setTimeout(() => {
            setShowLoading(false);
            startTimeRef.current = null;
          }, remainingTime);
        } else {
          // 최소 시간이 지났으면 바로 종료
          setShowLoading(false);
          startTimeRef.current = null;
        }
      } else {
        setShowLoading(false);
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isLoading, minDuration]);

  return showLoading;
}
