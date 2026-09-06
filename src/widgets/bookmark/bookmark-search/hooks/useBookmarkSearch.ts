import { FormEvent, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * 북마크 검색어(q) URL 파라미터와 입력창 로컬 상태를 관리하는 훅
 */
export const useBookmarkSearch = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') ?? '';

  const [searchInput, setSearchInput] = useState(searchQuery);

  // URL이 변경되면 로컬 상태도 동기화 (예: 뒤로가기)
  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const applySearch = (value: string) => {
    const trimmed = value.trim();
    if (trimmed) {
      searchParams.set('q', trimmed);
    } else {
      searchParams.delete('q');
    }
    setSearchParams(searchParams, { replace: true });
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
