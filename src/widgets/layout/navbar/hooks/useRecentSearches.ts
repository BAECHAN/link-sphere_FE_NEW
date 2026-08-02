import { useAppLocalStorage } from '@/shared/hooks/useAppLocalStorage';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const RECENT_SEARCHES_KEY = STORAGE_KEYS.SEARCH.RECENT;
const MAX_RECENT_SEARCHES = 10;

/**
 * 모바일 네비바 검색의 최근 검색어를 localStorage에 저장·관리하는 훅
 */
export function useRecentSearches() {
  const [recentSearches, setRecentSearches, removeRecentSearches] = useAppLocalStorage<string[]>(
    RECENT_SEARCHES_KEY,
    []
  );

  const addRecentSearch = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) {
      return;
    }

    setRecentSearches((prev) =>
      [trimmed, ...prev.filter((item) => item !== trimmed)].slice(0, MAX_RECENT_SEARCHES)
    );
  };

  const removeRecentSearch = (query: string) => {
    setRecentSearches((prev) => prev.filter((item) => item !== query));
  };

  const clearRecentSearches = () => {
    removeRecentSearches();
  };

  return { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches };
}
