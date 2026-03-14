import { useParams, useNavigate, Link } from 'react-router-dom';
import { useFetchPostDetailQuery } from '@/entities/post/api/post.queries';
import { PostCard } from '@/widgets/post/post-card/ui/PostCard';
import { CommentList } from '@/widgets/comment/comment-list/ui/CommentList';
import { Button } from '@/shared/ui/atoms/button';
import { ArrowLeft } from 'lucide-react';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: post, isLoading, isError } = useFetchPostDetailQuery(id || '');

  if (isLoading) {
    return (
      <div className="flex h-[400px] items-center justify-center">
        <Spinner className="h-10 w-10 animate-spin" />
      </div>
    );
  }

  if (isError || !post) {
    return (
      <div className="flex h-[400px] flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">{TEXTS.post.detail.notFound}</p>
        <Button onClick={() => navigate(-1)}>{TEXTS.post.detail.back}</Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link to={ROUTES_PATHS.POST.ROOT}>
          <ArrowLeft className="h-5 w-5" />
        </Link>
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
