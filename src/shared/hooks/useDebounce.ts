import { useEffect, useState } from 'react';

/**
 * 값의 변경을 지연시키는 debounce hook
 * @param value - debounce를 적용할 값
 * @param delay - 지연 시간 (ms)
 * @returns debounced된 값
 */
export function useDebounce<T>(value: T, delay: number = 500): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}
