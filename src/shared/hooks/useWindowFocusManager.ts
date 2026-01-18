import { focusManager } from '@tanstack/react-query';
import { useEffect } from 'react';

/**
 * React Query의 윈도우 포커스 감지 문제를 해결하는 Hook
 * Focus Manager를 수동으로 제어하여 refetchOnWindowFocus가 확실히 작동하도록 보장
 */
export const useWindowFocusManager = () => {
  useEffect(() => {
    const handleFocus = () => {
      focusManager.setFocused(true);
    };

    const handleBlur = () => {
      focusManager.setFocused(false);
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleBlur);
    };
  }, []);
};
