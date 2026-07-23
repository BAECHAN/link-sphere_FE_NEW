import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * 앱 안에서 이동해 온 경우 브라우저 뒤로가기(POP)로 되돌아가 <ScrollRestoration />이
 * 이전 화면의 스크롤 위치를 복원하게 한다.
 * navigate(path)는 새 이동(PUSH)이라 항상 최상단으로 초기화되므로 대신 쓰지 않는다.
 *
 * @param fallbackPath 링크로 바로 진입해 되돌아갈 앱 내 이력이 없을 때 이동할 경로
 */
export function useGoBack(fallbackPath: string) {
  const navigate = useNavigate();
  const location = useLocation();

  return useCallback(() => {
    // react-router는 세션의 첫 진입 항목에만 'default' key를 부여한다 (= 뒤로 갈 이력 없음)
    if (location.key === 'default') {
      navigate(fallbackPath);
      return;
    }

    navigate(-1);
  }, [location.key, navigate, fallbackPath]);
}
