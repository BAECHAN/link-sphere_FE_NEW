import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

/**
 * 화면을 덮는 오버레이(모바일 드로어·모달 등)의 열림 상태를 히스토리 엔트리로 관리한다.
 * 열 때 새 엔트리를 push하므로 뒤로가기(하드웨어 버튼·엣지 스와이프)를 누르면
 * 페이지 이동이 아니라 이 엔트리가 pop되며 오버레이만 자연스럽게 닫힌다.
 * (Navbar의 모바일 검색 패널과 동일한 패턴 - 오버레이를 겹쳐 쌓지 않는 것을 전제로 한다)
 *
 * @param key location.state에 실을 키. 오버레이마다 고유해야 한다.
 */
export function useHistoryOverlay(key: string) {
  const navigate = useNavigate();
  const location = useLocation();

  const isOpen = Boolean((location.state as Record<string, boolean> | null)?.[key]);

  const open = useCallback(() => {
    navigate(`${location.pathname}${location.search}`, { state: { [key]: true } });
  }, [navigate, location.pathname, location.search, key]);

  const close = useCallback(() => {
    // 이미 닫혀 있는데 back하면 이 엔트리가 없어 실제 페이지를 떠나므로 반드시 가드한다
    if (isOpen) {
      navigate(-1);
    }
  }, [isOpen, navigate]);

  return { isOpen, open, close };
}
