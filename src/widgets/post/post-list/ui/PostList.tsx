import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { Loader2 } from 'lucide-react';
import { usePostList } from '@/widgets/post/post-list/hooks/usePostList';

import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { TEXTS } from '@/shared/config/texts';

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

function PostListContent() {
  const { posts, hasNextPage, isFetchingNextPage, observerRef } = usePostList();

  if (posts.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/10">
        {TEXTS.messages.info.noPosts}
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
