import { useCallback, useState } from 'react';
import { SessionStorageUtil } from '@/shared/utils/storage.util';

/**
 * sessionStorage를 React 상태로 관리하는 커스텀 훅
 * @param key - sessionStorage에 저장할 키
 * @param initialValue - 초기값 (sessionStorage에 값이 없을 때 사용)
 * @returns [storedValue, setValue] - 저장된 값과 값을 업데이트하는 함수
 */
export function useAppSessionStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = SessionStorageUtil.getItem<T>(key);
    return item !== null ? item : initialValue;
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value;
        SessionStorageUtil.setItem(key, valueToStore);
        return valueToStore;
      });
    },
    [key]
  );

  return [storedValue, setValue] as const;
}
