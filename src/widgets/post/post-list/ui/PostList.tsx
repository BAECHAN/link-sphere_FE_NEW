import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { Loader2 } from 'lucide-react';
import { usePostList } from '@/widgets/post/post-list/hooks/usePostList';
import { PostListSkeleton } from '@/widgets/post/post-list/ui/PostCardSkeleton';
import { POST_GRID_CLASS } from '@/widgets/post/post-list/config/post-grid.const';

import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import { EmptyState } from '@/shared/ui/elements/EmptyState';
import { ErrorState } from '@/shared/ui/elements/ErrorState';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { usePullToRefresh } from '@/shared/hooks/usePullToRefresh';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@/shared/lib/tailwind/utils';

export function PostList() {
  return (
    <AsyncBoundary
      loadingFallback={
        <DelayedFallback>
          <PostListSkeleton />
        </DelayedFallback>
      }
      errorFallback={() => <ErrorState>{TEXTS.messages.error.fetchPosts}</ErrorState>}
    >
      <PostListContent />
    </AsyncBoundary>
  );
}

const PULL_INDICATOR_HEIGHT = 44;

function PostListContent() {
  const {
    posts,
    correctedSearch,
    isFetchingNextPage,
    refetch,
    isRefetching,
    containerRef,
    virtualizer,
    rows,
  } = usePostList();
  const { pullDistance, isPulling, isReady } = usePullToRefresh({ onRefresh: refetch });

  if (posts.length === 0) {
    return (
      <EmptyState className="border rounded-lg bg-muted/10">
        {TEXTS.messages.info.noPosts}
      </EmptyState>
    );
  }

  const indicatorHeight = isRefetching ? PULL_INDICATOR_HEIGHT : pullDistance;
  const scrollMargin = virtualizer.options.scrollMargin;

  return (
    <div>
      {correctedSearch && (
        <div className="text-sm text-muted-foreground text-center mb-6">
          {TEXTS.post.search.corrected(correctedSearch)}
        </div>
      )}

      <div
        className="flex items-end justify-center overflow-hidden"
        style={{
          height: indicatorHeight,
          transition: isPulling ? 'none' : 'height 200ms ease',
        }}
        aria-hidden={indicatorHeight === 0}
      >
        {(pullDistance > 0 || isRefetching) && (
          <Spinner
            className={cn('size-6 text-primary', isRefetching ? 'animate-spin' : 'animate-none')}
            style={
              isRefetching
                ? { marginBottom: 10 }
                : {
                    marginBottom: 10,
                    opacity: Math.min(pullDistance / PULL_INDICATOR_HEIGHT, 1),
                    transform: `rotate(${isReady ? 180 : pullDistance * 2}deg)`,
                  }
            }
          />
        )}
      </div>

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
              <div className={POST_GRID_CLASS}>
                {rowPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    backSource="feed"
                    // 첫 행(최대 3장)만 LCP 후보로 우선 로딩한다 - 실측: 이 썸네일이 프로덕션
                    // LCP 요소였다(docs/plans/2026-09-25-lighthouse-perf.md 참고).
                    priorityThumbnail={virtualRow.index === 0}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {isFetchingNextPage && (
        <div className="flex justify-center p-4 mt-6">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
