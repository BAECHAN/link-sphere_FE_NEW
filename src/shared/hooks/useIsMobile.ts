import { useState, useEffect } from 'react';
import { MOBILE_MEDIA_QUERY } from '@/shared/config/const';

// Tailwind max-md와 같은 조건이다. UA는 보지 않는다 - 휴대폰을 가로로 돌리거나 태블릿이면 CSS는
// 데스크톱 배치인데 UA로 모바일이라 하면 JS만 모바일 UI를 골라 둘이 어긋난다(근거는 responsive-ux
// skill "브레이크포인트").
function checkIsMobile() {
  return typeof window === 'undefined' ? false : window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

export function useIsMobile() {
  // 첫 렌더부터 올바른 값을 가지도록 lazy init - false로 시작하면 모바일에서
  // 데스크톱 UI가 잠깐 보였다 교체되는 깜빡임이 생긴다.
  const [isMobile, setIsMobile] = useState(checkIsMobile);

  useEffect(() => {
    // 화면 크기 변경 시 업데이트 (선택 사항)
    const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
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
