import { FormEvent, useState } from 'react';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';

/**
 * 북마크 검색어(q) URL 파라미터와 입력창 로컬 상태를 관리하는 훅
 */
export const useBookmarkSearch = () => {
  const { searchParams, updateSearchParams } = useSearchParamsDraft();
  const searchQuery = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(searchQuery);
  const [prevSearchQuery, setPrevSearchQuery] = useState(searchQuery);
  const [isClearedByUser, setIsClearedByUser] = useState(false);

  // URL이 변경되면 로컬 상태도 동기화 (예: 뒤로가기). effect가 아니라 렌더 중에 맞춘다
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  // 단, 사용자가 지워서 q를 뺀 경우(handleInputChange·handleClear)는 비추지 않는다. 라우터 갱신은
  // transition이라(RouterProvider의 v7_startTransition) 입력보다 늦게 도착하고, 그 사이 친 글자를 빈 값으로 덮는다.
  if (searchQuery !== prevSearchQuery) {
    setPrevSearchQuery(searchQuery);
    setIsClearedByUser(false);

    if (!isClearedByUser || searchQuery !== '') {
      setSearchInput(searchQuery);
    }
  }

  const applySearch = (value: string) => {
    const trimmed = value.trim();
    updateSearchParams(
      (draft) => {
        if (trimmed) {
          draft.set('q', trimmed);
        } else {
          draft.delete('q');
        }
      },
      { replace: true }
    );
  };

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault();
    applySearch(searchInput);
  };

  const handleClear = () => {
    setSearchInput('');
    setIsClearedByUser(true);
    applySearch('');
  };

  // 검색 중에 입력을 다 지우면 X 버튼처럼 바로 검색을 해제한다. 다 지우면 X도 사라져(input.tsx)
  // 데스크톱에서는 Enter 말고 전체 목록으로 돌아갈 방법이 없었다. 한글 마지막 자모를 지우는 입력은
  // 조합 중에 오므로 isComposing으로 거르지 않는다.
  const handleInputChange = (value: string) => {
    setSearchInput(value);

    if (value !== '' || searchQuery === '') {
      return;
    }

    setIsClearedByUser(true);
    applySearch('');
  };

  return {
    searchInput,
    handleInputChange,
    handleSubmit,
    handleClear,
  };
};
