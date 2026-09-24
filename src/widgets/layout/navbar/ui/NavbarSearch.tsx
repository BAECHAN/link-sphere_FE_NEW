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
  const { searchInput, setSearchInput, handleClear } = useNavbarSearch();
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

  const handleClearClick = () => {
    handleClear();
    inputRef.current?.focus();
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

      // 2단계: 이미 닫혀 있으면 입력만 비운다(URL q는 유지, 재오픈 안 함 - setSearchInput은
      // onChange를 거치지 않으므로 위 재오픈 규칙이 발동하지 않는다). X 버튼(handleClearClick)은
      // 검색 자체를 해제해 URL q까지 지우지만, ESC 2단계는 WAI-ARIA APG Combobox 패턴의
      // "clears the combobox"(입력값만 비움)를 그대로 따른다 - 둘의 의도가 다르다
      // (2026-09-24, 헤더 X를 북마크와 통일하며 갈라짐).
      setSearchInput('');
      return;
    }

    if (!isOpen) {
      return;
    }

    const clearRow = recentSearches.length;
    const lastItemRow = recentSearches.length - 1;

    // 순환(wrap-around) 없는 일직선 구조다: 입력창 ↔ 모두지우기 ↔ 검색어1 ↔ ... ↔
    // 마지막 검색어. "모두 지우기"는 시각적으로도 입력창 바로 아래(헤더, 고정)라 논리
    // 순서도 그 자리에 둔다 - 끝에서 반대쪽 끝으로 되돌아가던 이전 동작(모듈로 연산)이
    // 실제로 써보니 방향감각과 어긋난다는 피드백을 받아 제거했다.
    if (e.key === 'ArrowDown') {
      e.preventDefault();

      if (activeRow === null || activeRow === clearRow) {
        // 입력창에서 내려갈 때는 "모두 지우기"를 건너뛰고 바로 첫 검색어로 간다 -
        // 검색어 재선택이 가장 흔한 동작이라 한 번에 닿아야 한다(의도적으로 유지).
        setActiveRow(0);
        setActiveCol(0);
        return;
      }

      if (activeRow === lastItemRow) {
        // 마지막 검색어 - 더 내려갈 곳이 없다. 순환하지 않는다.
        return;
      }

      setActiveRow(activeRow + 1);
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();

      if (activeRow === clearRow) {
        // "모두 지우기"보다 위엔 입력창뿐이다 - 그리드를 나간다.
        setActiveRow(null);
        return;
      }

      if (activeRow === null || activeRow === 0) {
        // 입력창 또는 첫 검색어 - 한 단계 위는 "모두 지우기"(항상 보이는 헤더)다.
        setActiveRow(clearRow);
        setActiveCol(0);
        return;
      }

      setActiveRow(activeRow - 1);
      return;
    }

    if (activeRow === null) {
      return;
    }

    if (e.key === 'ArrowRight') {
      e.preventDefault();

      // 같은 행 안에서만 이동한다(행 사이를 넘나들며 순환하지 않는다). "모두 지우기"
      // 행은 셀이 1개라 좌우 이동 자체가 없다.
      if (activeRow === clearRow || activeCol === 1) {
        return;
      }

      setActiveCol(1);
      return;
    }

    if (e.key === 'ArrowLeft') {
      e.preventDefault();

      if (activeRow === clearRow || activeCol === 0) {
        return;
      }

      setActiveCol(0);
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
          onClick={handleClearClick}
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
