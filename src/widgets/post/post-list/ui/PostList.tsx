import { Fragment, type ReactNode } from 'react';
import { Loader2 } from 'lucide-react';
import {
  usePostList,
  usePostListApplying,
  usePostListErrorReset,
} from '@/widgets/post/post-list/hooks/usePostList';
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
  const { resetKeys, onReset } = usePostListErrorReset();
  const isApplying = usePostListApplying();

  // 덮개는 absolute가 아니라 grid 같은 칸에 겹친다 - 이 래퍼를 relative로 두면 가상 스크롤이
  // 목록 위치를 재는 offsetTop(useWindowGridVirtualizer.ts의 useScrollMargin)의 기준이 이 래퍼로
  // 바뀌어 scrollMargin이 틀어진다. grid 항목은 position 없이도 z-index가 적용된다.
  return (
    <div className="grid grid-cols-1" aria-busy={isApplying}>
      <div className="min-w-0 [grid-area:1/1]">
        <AsyncBoundary
          loadingFallback={
            <DelayedFallback>
              <PostListSkeleton grid={grid} />
            </DelayedFallback>
          }
          errorFallback={() => <ErrorState>{TEXTS.messages.error.fetchPosts}</ErrorState>}
          resetKeys={resetKeys}
          onReset={onReset}
        >
          <PostListContent renderPost={renderPost} grid={grid} />
        </AsyncBoundary>
      </div>

      {/* 조건을 바꾼 뒤 응답이 늦으면 이전 목록을 흐리게 덮는다 - PostCard의 isUpdating 덮개와 같은
          형태. 문구는 카드 글자 위에 겹치지 않게 알약에 담고, 긴 목록을 내려 보고 있어도 보이도록
          navbar 바로 아래에 붙여 따라오게 한다(BookmarkPage 폴더 패널과 같은 top, docs/SEARCH.md §5) */}
      {isApplying && (
        <div className="z-raised bg-background/60 animate-in fade-in duration-200 motion-reduce:animate-none [grid-area:1/1]">
          <div
            role="status"
            className="sticky top-[calc(var(--navbar-height)+1rem)] flex justify-center pt-6"
          >
            <span className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1.5 shadow-sm">
              <Loader2
                aria-hidden="true"
                className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none"
              />
              <span className="text-sm font-medium text-muted-foreground">
                {TEXTS.post.search.applying}
              </span>
            </span>
          </div>
        </div>
      )}
    </div>
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
