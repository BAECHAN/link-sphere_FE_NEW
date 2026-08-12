import { useState, useEffect } from 'react';

function checkIsMobile() {
  const userAgent = typeof window.navigator === 'undefined' ? '' : navigator.userAgent;
  const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    userAgent
  );

  // 화면 너비를 통한 보조 체크 (옵션)
  const isNarrowScreen =
    typeof window === 'undefined' ? false : window.matchMedia('(max-width: 768px)').matches;

  return isMobileDevice || isNarrowScreen;
}

export function useIsMobile() {
  // 첫 렌더부터 올바른 값을 가지도록 lazy init - false로 시작하면 모바일에서
  // 데스크톱 UI가 잠깐 보였다 교체되는 깜빡임이 생긴다.
  const [isMobile, setIsMobile] = useState(checkIsMobile);

  useEffect(() => {
    setIsMobile(checkIsMobile());

    // 화면 크기 변경 시 업데이트 (선택 사항)
    const mediaQuery = window.matchMedia('(max-width: 768px)');
    const handleChange = () => setIsMobile(checkIsMobile());

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
