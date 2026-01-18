import { useCallback, useEffect, useState } from 'react';
import { LocalStorageUtil } from '@/shared/utils/storage.util';

/**
 * localStorage를 React 상태로 관리하는 커스텀 훅
 * @param key - localStorage에 저장할 키
 * @param initialValue - 초기값 (localStorage에 값이 없을 때 사용)
 * @returns [storedValue, setValue, removeValue] - 저장된 값, 값 업데이트 함수, 값 삭제 함수
 */
export function useAppLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    const item = LocalStorageUtil.getItem<T>(key);
    return item !== null ? item : initialValue;
  });

  const setValue = useCallback(
    (value: T | ((val: T) => T)) => {
      setStoredValue((prevValue) => {
        const valueToStore = value instanceof Function ? value(prevValue) : value;
        LocalStorageUtil.setItem(key, valueToStore);
        return valueToStore;
      });
    },
    [key]
  );

  const removeValue = useCallback(() => {
    setStoredValue(initialValue);
    LocalStorageUtil.removeItem(key);
  }, [key, initialValue]);

  useEffect(() => {
    /**
     * 다른 탭/창에서 localStorage 값이 변경되었을 때 처리
     * 'storage' 이벤트는 다른 탭/창에서만 발생 (같은 탭에서는 발생하지 않음)
     */
    const handleCrossTabStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          setStoredValue(JSON.parse(e.newValue) as T);
        } catch (error) {
          console.error(`Error parsing localStorage value for key "${key}":`, error);
        }
      }
    };

    // 다른 탭/창에서의 localStorage 변경 감지
    window.addEventListener('storage', handleCrossTabStorageChange as EventListener);
    return () => {
      window.removeEventListener('storage', handleCrossTabStorageChange as EventListener);
    };
  }, [key]);

  return [storedValue, setValue, removeValue] as const;
}
