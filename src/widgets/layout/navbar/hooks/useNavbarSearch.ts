import { useEffect, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';

/**
 * 헤더 검색 입력창(데스크톱 NavbarSearch·모바일 MobileNavbarSearch)의 값을
 * 게시글 목록 URL의 검색어(q)와 동기화하는 훅.
 *
 * 게시글 목록(/post) 페이지에 있을 때만 URL의 q를 미러하고, 그 외 페이지(북마크 등)에서는
 * 빈 값을 반환한다. 북마크 페이지도 같은 이름의 q 파라미터를 쓰기 때문에(useBookmarkSearch),
 * 경로를 가리지 않으면 헤더 검색창이 다른 페이지의 검색어를 잘못 표시하게 된다.
 */
export function useNavbarSearch() {
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();

  const isPostListPage = pathname === ROUTES_PATHS.POST.ROOT;
  const appliedQuery = isPostListPage ? (searchParams.get('q') ?? '') : '';

  const [searchInput, setSearchInput] = useState(appliedQuery);

  // URL의 q가 바뀌면(제출, 카테고리 칩 클릭, 뒤로가기, 페이지 이동 등) 입력값도 따라간다.
  useEffect(() => {
    setSearchInput(appliedQuery);
  }, [appliedQuery]);

  return { searchInput, setSearchInput };
}
