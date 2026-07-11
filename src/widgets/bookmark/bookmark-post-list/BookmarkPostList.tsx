import { Loader2 } from 'lucide-react';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { useFolderPostsInfiniteQuery } from '@/entities/folder/api/folder.queries';
import { FolderKey, FolderSort } from '@/entities/folder/model/folder.schema';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@/shared/lib/tailwind/utils';

interface BookmarkPostListProps {
  folderKey: FolderKey;
  sort: FolderSort;
  search?: string;
  className?: string;
}

export function BookmarkPostList({ folderKey, sort, search, className }: BookmarkPostListProps) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useFolderPostsInfiniteQuery(folderKey, sort, search);

  const observerRef = useIntersectionObserver({
    onIntersect: () => {
      if (hasNextPage && !isFetchingNextPage) fetchNextPage();
    },
    enabled: hasNextPage && !isFetchingNextPage,
    rootMargin: '0px 0px 1200px 0px',
  });

  if (isLoading) {
    return (
      <div className={cn('flex justify-center py-12', className)}>
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const posts = data?.posts ?? [];

  if (posts.length === 0) {
    return (
      <div
        className={cn(
          'text-center py-16 text-muted-foreground border rounded-lg bg-muted/10',
          className
        )}
      >
        {search
          ? TEXTS.bookmark.empty.searchNoResult
          : folderKey === 'all'
            ? TEXTS.bookmark.empty.all
            : folderKey === 'uncategorized'
              ? TEXTS.bookmark.empty.uncategorized
              : TEXTS.bookmark.empty.folder}
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
        {posts.map((post) => (
          <PostCard key={post.id} post={post} />
        ))}
      </div>

      {hasNextPage && (
        <div ref={observerRef} className="flex justify-center p-4">
          {isFetchingNextPage && <Loader2 className="size-6 animate-spin text-muted-foreground" />}
        </div>
      )}
    </div>
  );
}
