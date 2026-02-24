import { useState, useEffect } from 'react';

export function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
      const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        userAgent
      );

      // 화면 너비를 통한 보조 체크 (옵션)
      const isNarrowScreen = window.matchMedia('(max-width: 768px)').matches;

      setIsMobile(isMobileDevice || isNarrowScreen);
    };

    checkIsMobile();

    // 화면 크기 변경 시 업데이트 (선택 사항)
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = () => checkIsMobile();

    // 구형 브라우저 지원 처리
    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleChange);
    } else {
      mediaQuery.addListener(handleChange);
    }

    return () => {
      if (mediaQuery.removeEventListener) {
        mediaQuery.removeEventListener('change', handleChange);
      } else {
        mediaQuery.removeListener(handleChange);
      }
    };
  }, []);

  return isMobile;
}
