import { FormEvent, useEffect, useState } from 'react';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';

/**
 * 북마크 검색어(q) URL 파라미터와 입력창 로컬 상태를 관리하는 훅
 */
export const useBookmarkSearch = () => {
  const { searchParams, updateSearchParams } = useSearchParamsDraft();
  const searchQuery = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(searchQuery);

  // URL이 변경되면 로컬 상태도 동기화 (예: 뒤로가기)
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

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
    applySearch('');
  };

  return {
    searchInput,
    setSearchInput,
    handleSubmit,
    handleClear,
  };
};
