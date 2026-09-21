import { XIcon } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@/shared/lib/tailwind/utils';

/**
 * 데스크톱 헤더 검색의 최근검색 드롭다운(grid) 요소 id. NavbarSearch가 입력창의
 * aria-controls/aria-activedescendant를 여기 맞춰 계산한다.
 */
export const RECENT_SEARCH_GRID_ID = 'navbar-recent-search-grid';

/**
 * row === recentSearches.length 는 "모두 지우기" 행(1셀)을 가리킨다.
 * 그 외 row는 검색어 행(0=검색어 셀, 1=삭제 셀)이다.
 */
export function getRecentSearchCellId(row: number, col: number): string {
  return `navbar-recent-search-cell-${row}-${col}`;
}

interface RecentSearchDropdownProps {
  recentSearches: string[];
  activeRow: number | null;
  activeCol: number;
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
}

export function RecentSearchDropdown({
  recentSearches,
  activeRow,
  activeCol,
  onSelect,
  onRemove,
  onClearAll,
}: RecentSearchDropdownProps) {
  // NavbarSearch의 useEffect가 0개가 되면 isOpen을 닫지만 그 사이 한 프레임 동안 이
  // 컴포넌트가 빈 배열로 렌더될 수 있다 - 그 프레임에 빈 그리드가 보이지 않게 가드한다.
  if (recentSearches.length === 0) {
    return null;
  }

  const clearRow = recentSearches.length;

  return (
    <div
      id={RECENT_SEARCH_GRID_ID}
      role="grid"
      aria-label={TEXTS.recentSearch.title}
      // 마우스로 셀을 클릭할 때 입력창의 focus가 빠지지 않게 한다. 빠지면 클릭이
      // 완료되기 전에 input onBlur가 먼저 발생해 드롭다운이 닫히며 클릭이 유실된다.
      onMouseDown={(e) => e.preventDefault()}
      className="absolute left-0 right-0 top-full z-popover mt-1 flex flex-col overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md"
    >
      {/* 헤더(모두 지우기)는 별도 스크롤 영역 밖에 있어 아래 목록을 스크롤해도 그대로 있다. */}
      <div role="rowgroup" className="shrink-0 border-b">
        <div role="row" className="flex items-center justify-between px-3 py-2">
          <span className="text-group-label text-muted-foreground">{TEXTS.recentSearch.title}</span>
          <div role="gridcell" id={getRecentSearchCellId(clearRow, 0)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              // 실제 DOM 포커스는 항상 입력창에 머문다 - 화살표 키로만 이 셀에
              // 가상 포커스(aria-activedescendant)가 옮겨간다. Tab 순서에서는 뺀다.
              tabIndex={-1}
              onClick={onClearAll}
              className={cn(
                'h-8 px-2 text-xs text-muted-foreground',
                activeRow === clearRow && 'bg-accent text-accent-foreground'
              )}
            >
              {TEXTS.recentSearch.clearAll}
            </Button>
          </div>
        </div>
      </div>

      <div role="rowgroup" className="max-h-[190px] overflow-y-auto">
        {recentSearches.map((query, row) => (
          <div key={query} role="row" className="flex items-center gap-1">
            <div role="gridcell" id={getRecentSearchCellId(row, 0)} className="min-w-0 flex-1">
              <Button
                type="button"
                variant="none"
                tabIndex={-1}
                onClick={() => onSelect(query)}
                className={cn(
                  'h-auto w-full justify-start truncate rounded-none px-3 py-2 text-left text-sm font-normal hover:bg-accent hover:text-accent-foreground',
                  activeRow === row && activeCol === 0 && 'bg-accent text-accent-foreground'
                )}
              >
                <span className="truncate">{query}</span>
              </Button>
            </div>
            <div role="gridcell" id={getRecentSearchCellId(row, 1)} className="shrink-0 pr-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                tabIndex={-1}
                onClick={() => onRemove(query)}
                aria-label={TEXTS.recentSearch.removeItem}
                className={cn(
                  'text-muted-foreground',
                  activeRow === row && activeCol === 1 && 'bg-accent text-foreground'
                )}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
