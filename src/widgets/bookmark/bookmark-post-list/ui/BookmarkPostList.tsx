import { Fragment, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  BookmarkFolderKey,
  BookmarkFolderSort,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { Post } from '@/entities/post/model/post.schema';
import { TEXTS } from '@/shared/config/texts';
import type { CardGridSpec } from '@/shared/hooks/useWindowGridVirtualizer';
import { cn } from '@/shared/lib/tailwind/utils';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import { EmptyState } from '@/shared/ui/elements/EmptyState';
import { useBookmarkPostList } from '@/widgets/bookmark/bookmark-post-list/hooks/useBookmarkPostList';

interface BookmarkPostListProps {
  /** 게시글 하나를 그리는 함수 - 목록은 어떤 카드를 그리는지 모르고 페이지가 넘긴다 (docs/FE-ARCHITECTURE.md §26) */
  renderPost: (post: Post) => ReactNode;
  /** renderPost가 그리는 카드의 치수 */
  grid: CardGridSpec;
  folderKey: BookmarkFolderKey;
  sort: BookmarkFolderSort;
  search?: string;
  className?: string;
}

export function BookmarkPostList({
  renderPost,
  grid,
  folderKey,
  sort,
  search,
  className,
}: BookmarkPostListProps) {
  const {
    posts,
    correctedSearch,
    isLoading,
    isFetchingNextPage,
    containerRef,
    virtualizer,
    rows,
    columnCount,
  } = useBookmarkPostList(grid, folderKey, sort, search);

  if (isLoading) {
    return (
      <DelayedFallback className={cn('flex justify-center py-12', className)}>
        <Loader2 className="size-8 animate-spin text-primary" />
      </DelayedFallback>
    );
  }

  if (posts.length === 0) {
    return (
      <EmptyState className={cn('border rounded-lg bg-muted/10', className)}>
        {search
          ? TEXTS.bookmark.empty.searchNoResult
          : folderKey === 'all'
            ? TEXTS.bookmark.empty.all
            : folderKey === 'uncategorized'
              ? TEXTS.bookmark.empty.uncategorized
              : TEXTS.bookmark.empty.folder}
      </EmptyState>
    );
  }

  const scrollMargin = virtualizer.options.scrollMargin;

  return (
    <div className={cn('space-y-6', className)}>
      {correctedSearch && (
        <div className="text-sm text-muted-foreground text-center">
          {TEXTS.post.search.corrected(correctedSearch)}
        </div>
      )}

      <div ref={containerRef} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowPosts = rows[virtualRow.index];
          if (!rowPosts) {
            return null;
          }

          return (
            <div
              key={virtualRow.key}
              data-index={virtualRow.index}
              ref={virtualizer.measureElement}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start - scrollMargin}px)`,
              }}
            >
              <div
                className={grid.className}
                style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
              >
                {rowPosts.map((post) => (
                  <Fragment key={post.id}>{renderPost(post)}</Fragment>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {isFetchingNextPage && (
        <div className="flex justify-center p-4">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
