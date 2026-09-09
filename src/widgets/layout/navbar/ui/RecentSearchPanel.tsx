import { XIcon } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
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
    <div className="md:hidden fixed inset-x-0 top-16 bottom-0 z-40 bg-background overflow-y-auto">
      <div className="flex flex-col pb-16">
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-muted-foreground">
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
          <p className="px-4 py-8 text-center text-sm text-muted-foreground">
            {TEXTS.recentSearch.empty}
          </p>
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
  );
}
