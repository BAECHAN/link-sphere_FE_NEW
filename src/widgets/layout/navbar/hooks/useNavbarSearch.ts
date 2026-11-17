import { useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';

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
  const { updateSearchParams } = useSearchParamsDraft();

  const isPostListPage = pathname === ROUTES_PATHS.POST.ROOT;
  const appliedQuery = isPostListPage ? (searchParams.get('q') ?? '') : '';

  const [searchInput, setSearchInput] = useState(appliedQuery);
  const [prevAppliedQuery, setPrevAppliedQuery] = useState(appliedQuery);
  const [isClearedByUser, setIsClearedByUser] = useState(false);

  // URL의 q가 바뀌면(제출, 카테고리 칩 클릭, 뒤로가기, 페이지 이동 등) 입력값도 따라간다.
  // effect가 아니라 렌더 중에 맞춘다 (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // 단, X 버튼으로 q를 뺀 경우(handleClear)는 비추지 않는다. 라우터 갱신은 transition이라(RouterProvider의
  // v7_startTransition) 새 목록 응답이 올 때까지 늦게 도착하고, 그 사이 친 글자를 빈 값으로 덮는다.
  if (appliedQuery !== prevAppliedQuery) {
    setPrevAppliedQuery(appliedQuery);
    setIsClearedByUser(false);

    if (!isClearedByUser || appliedQuery !== '') {
      setSearchInput(appliedQuery);
    }
  }

  // 데스크톱 X 버튼: 입력값을 비우고, 게시글 목록 페이지에 있을 때만 URL의 q도 지워 검색을 해제한다. 모바일 검색
  // 화면의 X는 이 함수를 쓰지 않고 입력만 비운다(MobileNavbarSearch.tsx)
  // (useBookmarkSearch.handleClear와 동일한 선례). 다른 페이지(북마크 등)에서는 이름이 같은
  // q를 잘못 건드리지 않도록 isPostListPage로 막는다 - 위 JSDoc이 경고하는 것과 같은 이유.
  const handleClear = () => {
    setSearchInput('');

    if (!isPostListPage) {
      return;
    }

    setIsClearedByUser(true);
    updateSearchParams(
      (draft) => {
        draft.delete('q');
      },
      { replace: true }
    );
  };

  return { searchInput, setSearchInput, handleClear };
}
