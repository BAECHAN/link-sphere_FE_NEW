import { useParams } from 'react-router-dom';
import { useSuspenseFetchPostDetailQuery } from '@/entities/post/api/post.queries';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { CommentList } from '@/widgets/comment/comment-list/ui/CommentList';
import { ArrowLeft } from 'lucide-react';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useGoBack } from '@/shared/hooks/useGoBack';

function PostDetailContent() {
  const { id } = useParams<{ id: string }>();
  const { data: post } = useSuspenseFetchPostDetailQuery(id || '');
  const goBack = useGoBack(ROUTES_PATHS.POST.ROOT);

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button type="button" onClick={goBack} aria-label={TEXTS.common.back}>
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-xl font-bold">{TEXTS.post.detail.heading}</h1>
      </div>

      <PostCard post={post} isDetail />

      <div className="pt-6 border-t">
        <h2 className="text-lg font-bold mb-6">{TEXTS.post.detail.commentsHeading}</h2>
        <CommentList postId={post.id} postAuthorId={post.author.id} />
      </div>
    </div>
  );
}

export function PostDetailPage() {
  return (
    <AsyncBoundary>
      <PostDetailContent />
    </AsyncBoundary>
  );
}
