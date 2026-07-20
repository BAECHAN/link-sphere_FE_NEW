import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { usePostList } from '@/widgets/post/post-list/hooks/usePostList';

import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { usePullToRefresh } from '@/shared/hooks/usePullToRefresh';
import { TEXTS } from '@/shared/config/texts';
import { cn } from '@/shared/lib/tailwind/utils';

export function PostList() {
  return (
    <AsyncBoundary
      loadingFallback={
        <div className="flex justify-center py-12">
          <Loader2 className="size-8 animate-spin text-primary" />
        </div>
      }
      errorFallback={() => (
        <div className="text-center py-12 text-destructive">{TEXTS.messages.error.fetchPosts}</div>
      )}
    >
      <PostListContent />
    </AsyncBoundary>
  );
}

const PULL_INDICATOR_HEIGHT = 44;

function PostListContent() {
  const { posts, hasNextPage, isFetchingNextPage, observerRef, refetch, isRefetching } =
    usePostList();
  const { pullDistance, isPulling, isReady } = usePullToRefresh({ onRefresh: refetch });

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
        {TEXTS.messages.info.noPosts}
      </div>
    );
  }

  const indicatorHeight = isRefetching ? PULL_INDICATOR_HEIGHT : pullDistance;

  return (
    <div className="space-y-6">
      <motion.div
        className="flex items-end justify-center overflow-hidden"
        initial={false}
        animate={{ height: indicatorHeight }}
        transition={{ duration: isPulling ? 0 : 0.2 }}
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
      </motion.div>

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
