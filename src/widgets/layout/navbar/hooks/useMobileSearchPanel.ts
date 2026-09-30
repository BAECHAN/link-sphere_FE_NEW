import { useLocation, useNavigate } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

interface NavbarLocationState {
  mobileSearchOpen?: boolean;
}

/**
 * 모바일 검색 패널의 열림/닫힘·검색 제출을 관리하는 훅.
 * addRecentSearch는 useRecentSearches가 이미 소유한 값이라(Navbar가 다른 자식에게도
 * 내려줘야 함) 훅 안에서 다시 구독하지 않고 파라미터로 받는다.
 */
export function useMobileSearchPanel(addRecentSearch: (query: string) => void) {
  const location = useLocation();
  const navigate = useNavigate();

  // 모바일 검색 패널 상태를 히스토리 엔트리에 실어 보낸다.
  // 열 때 새 엔트리를 push하므로 뒤로가기(하드웨어 버튼·엣지 스와이프)를 누르면
  // 페이지 이동이 아니라 이 엔트리가 pop되며 패널만 자연스럽게 닫힌다.
  const isMobileSearchOpen = Boolean(
    (location.state as NavbarLocationState | null)?.mobileSearchOpen
  );

  const openMobileSearch = () => {
    // preventScrollReset 없으면 <ScrollRestoration/>이 이 PUSH를 새 페이지로 보고
    // window.scrollTo(0, 0)을 실행해 배경 스크롤이 최상단으로 튄다(useHistoryOverlay와 같은 이유).
    navigate(`${location.pathname}${location.search}`, {
      state: { mobileSearchOpen: true },
      preventScrollReset: true,
    });
  };

  const closeMobileSearch = () => {
    if (isMobileSearchOpen) {
      navigate(-1);
    }
  };

  const handleSearchSubmit = (query: string) => {
    const trimmed = query.trim();
    if (trimmed) {
      addRecentSearch(trimmed);
    }
    const params = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
    // replace: 검색열림 엔트리를 결과 화면으로 대체 → 결과에서 뒤로가기 시 검색 패널이 다시 열리지 않음
    navigate(`${ROUTES_PATHS.POST.ROOT}${params}`, { replace: true });
  };

  return { isMobileSearchOpen, openMobileSearch, closeMobileSearch, handleSearchSubmit };
}
