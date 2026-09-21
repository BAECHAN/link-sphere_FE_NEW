import { Input } from '@/shared/ui/atoms/input';
import { Button } from '@/shared/ui/atoms/button';
import { SearchIcon } from 'lucide-react';
import { Kbd } from '@/shared/ui/atoms/kbd';
import { useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useKeydown } from '@/shared/hooks/useKeydown';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { XIcon } from 'lucide-react';
import { useNavbarSearch } from '@/widgets/layout/navbar/hooks/useNavbarSearch';
import {
  RecentSearchDropdown,
  RECENT_SEARCH_GRID_ID,
  getRecentSearchCellId,
} from '@/widgets/layout/navbar/ui/RecentSearchDropdown';

interface NavbarSearchProps {
  recentSearches: string[];
  onAddRecentSearch: (query: string) => void;
  onRemoveRecentSearch: (query: string) => void;
  onClearRecentSearches: () => void;
}

export const NavbarSearch = ({
  recentSearches,
  onAddRecentSearch,
  onRemoveRecentSearch,
  onClearRecentSearches,
}: NavbarSearchProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const { searchInput, setSearchInput } = useNavbarSearch();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { updateSearchParams } = useSearchParamsDraft();

  // 드롭다운 열림 상태는 오직 이벤트(포커스/입력/blur/키보드)에서만 바뀐다 - 입력값에서
  // 파생하거나 useEffect로 동기화하지 않는다. 파생시키면 ESC 2단계(입력 비우기)가 onChange를
  // 안 거치므로 문제없지만, URL→input 미러(useNavbarSearch)가 /post→/bookmark 이동 시
  // 입력을 ''로 만들 때 포커스가 남아있으면 드롭다운이 저절로 열려버린다.
  const [isOpen, setIsOpen] = useState(false);
  // row === recentSearches.length ⇒ "모두 지우기" 행. activeRow === null ⇒ 가상 포커스 없음
  // (실제 DOM 포커스는 항상 입력창에 머문다 - aria-activedescendant로만 가리킨다).
  const [activeRow, setActiveRow] = useState<number | null>(null);
  const [activeCol, setActiveCol] = useState(0);

  useKeydown({ key: '/' }, () => {
    inputRef.current?.focus();
    inputRef.current?.select();
  });

  const submitQuery = (raw: string) => {
    const trimmed = raw.trim();

    if (trimmed) {
      onAddRecentSearch(trimmed);
    }

    setIsOpen(false);
    setActiveRow(null);

    // /post에서는 현재 URL의 filter 등을 보존한 채 q만 갱신한다. setSearchParams는
    // pathname을 유지하므로 이 분기에서만 쓸 수 있다.
    if (pathname === ROUTES_PATHS.POST.ROOT) {
      updateSearchParams((draft) => {
        if (trimmed) {
          draft.set('q', trimmed);
        } else {
          draft.delete('q');
        }
      });

      return;
    }

    // 다른 페이지(/bookmark 등)의 파라미터는 그 페이지 것이라 옮기지 않는다.
    const params = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
    navigate(`${ROUTES_PATHS.POST.ROOT}${params}`);
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    submitQuery(searchInput);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchInput(value);
    setActiveRow(null);

    if (value === '') {
      if (recentSearches.length > 0) {
        setIsOpen(true);
      }
      return;
    }

    setIsOpen(false);
  };

  const handleFocus = () => {
    if (recentSearches.length === 0) {
      return;
    }
    setIsOpen(true);
    setActiveRow(null);
  };

  const handleBlur = () => {
    setIsOpen(false);
    setActiveRow(null);
  };

  const handleClearAll = () => {
    onClearRecentSearches();
    setIsOpen(false);
    setActiveRow(null);
  };

  const handleRemoveViaKeyboard = (row: number, term: string) => {
    onRemoveRecentSearch(term);

    const newLength = recentSearches.length - 1;
    if (newLength === 0) {
      setActiveRow(null);
      return;
    }

    setActiveRow(Math.min(row, newLength - 1));
    setActiveCol(0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 한글 등 IME 조합 중 키 이벤트는 무시한다 - 조합 완료 이벤트와 겹쳐 중복 처리되는
    // 것을 막는다(useFolderActions.ts 등 이 레포의 기존 관용구).
    if (e.nativeEvent.isComposing) {
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();

      // 1단계: 드롭다운이 열려 있으면 닫기만 한다(입력값 보존).
      if (isOpen) {
        setIsOpen(false);
        setActiveRow(null);
        return;
      }

      // 2단계: 이미 닫혀 있으면 입력만 비운다 - X 버튼과 동일(URL q는 유지, 재오픈 안 함.
      // setSearchInput은 onChange를 거치지 않으므로 위 재오픈 규칙이 발동하지 않는다).
      setSearchInput('');
      return;
    }

    if (!isOpen) {
      return;
    }

    const clearRow = recentSearches.length;
    const totalRows = recentSearches.length + 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();

      if (activeRow === null) {
        setActiveRow(0);
        setActiveCol(0);
        return;
      }

      const nextRow = (activeRow + 1) % totalRows;
      setActiveRow(nextRow);
      setActiveCol(nextRow === clearRow ? 0 : activeCol);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();

      if (activeRow === null) {
        setActiveRow(clearRow);
        setActiveCol(0);
        return;
      }

      const prevRow = (activeRow - 1 + totalRows) % totalRows;
      setActiveRow(prevRow);
      setActiveCol(prevRow === clearRow ? 0 : activeCol);
      return;
    }

    if (activeRow === null) {
      return;
    }

    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();

      // 검색어 행은 2셀(검색어·삭제), "모두 지우기" 행은 1셀 - row-major 순서로 이어붙여
      // 순환한다(APG "Editable Combobox with Grid Popup" 예제와 동일한 규칙).
      const cells: Array<[number, number]> = [];
      for (let row = 0; row < recentSearches.length; row += 1) {
        cells.push([row, 0], [row, 1]);
      }
      cells.push([clearRow, 0]);

      const currentIndex = cells.findIndex(([row, col]) => row === activeRow && col === activeCol);
      const delta = e.key === 'ArrowRight' ? 1 : -1;
      const next = cells[(currentIndex + delta + cells.length) % cells.length];

      if (!next) {
        return;
      }

      setActiveRow(next[0]);
      setActiveCol(next[1]);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();

      if (activeRow === clearRow) {
        handleClearAll();
        return;
      }

      const term = recentSearches[activeRow];
      if (!term) {
        return;
      }

      if (activeCol === 0) {
        submitQuery(term);
        return;
      }

      handleRemoveViaKeyboard(activeRow, term);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="relative w-full">
      <SearchIcon className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
      <Input
        ref={inputRef}
        id="header-search-input"
        role="combobox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? RECENT_SEARCH_GRID_ID : undefined}
        aria-activedescendant={
          isOpen && activeRow !== null ? getRecentSearchCellId(activeRow, activeCol) : undefined
        }
        aria-autocomplete="none"
        autoComplete="off"
        placeholder={TEXTS.placeholders.postSearch}
        value={searchInput}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="pl-8 pr-10 bg-muted/50 border-none transition-all focus:bg-background focus:ring-1 focus:ring-primary/20"
      />
      {searchInput.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={TEXTS.ariaLabels.inputClear}
          className="absolute right-1 top-1/2 -translate-y-1/2"
          onClick={() => setSearchInput('')}
        >
          <XIcon className="size-4 text-muted-foreground" />
        </Button>
      ) : (
        <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none items-center gap-1 rounded border px-1.5 font-mono text-micro font-medium opacity-100 flex size-5">
          <span className="text-xs">/</span>
        </Kbd>
      )}
      {isOpen && (
        <RecentSearchDropdown
          recentSearches={recentSearches}
          activeRow={activeRow}
          activeCol={activeCol}
          onSelect={submitQuery}
          onRemove={onRemoveRecentSearch}
          onClearAll={handleClearAll}
        />
      )}
    </form>
  );
};
