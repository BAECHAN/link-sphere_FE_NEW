import { Loader2 } from 'lucide-react';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import {
  BookmarkFolderKey,
  BookmarkFolderSort,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@/shared/lib/tailwind/utils';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import { EmptyState } from '@/shared/ui/elements/EmptyState';
import { useBookmarkPostList } from '@/widgets/bookmark/bookmark-post-list/hooks/useBookmarkPostList';
import { BOOKMARK_GRID_CLASS } from '@/widgets/bookmark/bookmark-post-list/config/bookmark-grid.const';

interface BookmarkPostListProps {
  folderKey: BookmarkFolderKey;
  sort: BookmarkFolderSort;
  search?: string;
  className?: string;
}

export function BookmarkPostList({ folderKey, sort, search, className }: BookmarkPostListProps) {
  const { posts, correctedSearch, isLoading, isFetchingNextPage, containerRef, virtualizer, rows } =
    useBookmarkPostList(folderKey, sort, search);

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
              <div className={BOOKMARK_GRID_CLASS}>
                {rowPosts.map((post) => (
                  <PostCard key={post.id} post={post} backSource="bookmark" />
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
