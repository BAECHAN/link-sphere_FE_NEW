import { XIcon } from 'lucide-react';
import { RemoveScroll } from 'react-remove-scroll';
import { Slot } from '@radix-ui/react-slot';
import { Button } from '@/shared/ui/atoms/button';
import { EmptyState } from '@/shared/ui/elements/EmptyState';
import { TEXTS } from '@/shared/config/texts';

interface RecentSearchPanelProps {
  recentSearches: string[];
  onSelect: (query: string) => void;
  onRemove: (query: string) => void;
  onClearAll: () => void;
}

export function RecentSearchPanel({
  recentSearches,
  onSelect,
  onRemove,
  onClearAll,
}: RecentSearchPanelProps) {
  return (
    // 이 패널이 배경(main/document)을 시각적으로 덮는 동안, 목록 끝까지 스크롤한 뒤 계속
    // 스와이프하면 배경으로 스크롤이 체이닝된다(overscroll-behavior 방지 장치가 없어서).
    // dialog.tsx의 DialogOverlay가 이미 쓰는 것과 같은 방식으로 배경 스크롤을 잠근다.
    // as={Slot}이라 별도 wrapper DOM이 안 생기고, 이 div 자신이 스크롤 영역이자 잠금
    // 경계라 shards는 필요 없다.
    <RemoveScroll as={Slot} allowPinchZoom>
      <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-panel bg-background overflow-y-auto">
        <div className="flex flex-col pb-16">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-group-label text-muted-foreground">
              {TEXTS.recentSearch.title}
            </span>
            {recentSearches.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearAll}
                className="h-8 px-2 text-xs text-muted-foreground"
              >
                {TEXTS.recentSearch.clearAll}
              </Button>
            )}
          </div>

          {recentSearches.length === 0 ? (
            <EmptyState className="px-4 text-sm">{TEXTS.recentSearch.empty}</EmptyState>
          ) : (
            <ul>
              {recentSearches.map((query) => (
                <li key={query} className="flex items-center gap-2 px-4 py-3 hover:bg-accent">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onSelect(query)}
                    className="h-auto flex-1 justify-start truncate p-0 text-left text-sm hover:bg-transparent"
                  >
                    {query}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => onRemove(query)}
                    className="h-auto w-auto shrink-0 p-1 text-muted-foreground"
                  >
                    <XIcon className="size-4" />
                    <span className="sr-only">{TEXTS.recentSearch.removeItem}</span>
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </RemoveScroll>
  );
}
