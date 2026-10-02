import { Fragment, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import { usePostList } from '@/widgets/post/post-list/hooks/usePostList';
import { PostListSkeleton } from '@/widgets/post/post-list/ui/PostCardSkeleton';
import { Post } from '@/entities/post/model/post.schema';

import type { CardGridSpec } from '@/shared/hooks/useWindowGridVirtualizer';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';
import { EmptyState } from '@/shared/ui/elements/EmptyState';
import { ErrorState } from '@/shared/ui/elements/ErrorState';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { usePullToRefresh } from '@/shared/hooks/usePullToRefresh';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@/shared/lib/tailwind/utils';

interface PostListProps {
  /**
   * 게시글 하나를 그리는 함수 - 목록은 어떤 카드를 그리는지 모르고 페이지가 넘긴다
   * (docs/FE-ARCHITECTURE.md §26). rowIndex는 가상 스크롤의 행 번호(0부터)다.
   */
  renderPost: (post: Post, rowIndex: number) => ReactNode;
  /** renderPost가 그리는 카드의 치수 */
  grid: CardGridSpec;
}

export function PostList({ renderPost, grid }: PostListProps) {
  return (
    <AsyncBoundary
      loadingFallback={
        <DelayedFallback>
          <PostListSkeleton grid={grid} />
        </DelayedFallback>
      }
      errorFallback={() => <ErrorState>{TEXTS.messages.error.fetchPosts}</ErrorState>}
    >
      <PostListContent renderPost={renderPost} grid={grid} />
    </AsyncBoundary>
  );
}

const PULL_INDICATOR_HEIGHT = 44;

function PostListContent({ renderPost, grid }: PostListProps) {
  const {
    posts,
    correctedSearch,
    isFetchingNextPage,
    refetch,
    isRefetching,
    containerRef,
    virtualizer,
    rows,
    columnCount,
  } = usePostList(grid);
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
              <div
                className={grid.className}
                style={{ gridTemplateColumns: `repeat(${columnCount}, minmax(0, 1fr))` }}
              >
                {rowPosts.map((post) => (
                  <Fragment key={post.id}>{renderPost(post, virtualRow.index)}</Fragment>
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
