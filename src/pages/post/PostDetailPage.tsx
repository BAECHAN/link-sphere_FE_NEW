import { useParams, useNavigate } from 'react-router-dom';
import { useFetchPostDetailQuery } from '@/domains/post/_common/api/post.queries';
import { PostCard } from '@/domains/post/_common/ui/PostCard';
import { CommentList } from '@/domains/post/features/comments/ui/CommentList';
import { Button } from '@/shared/ui/atoms/button';
import { ArrowLeft } from 'lucide-react';
import { Spinner } from '@/shared/ui/atoms/spinner';

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
        <p className="text-muted-foreground">포스트를 찾을 수 없습니다.</p>
        <Button onClick={() => navigate(-1)}>뒤로 가기</Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">Post Details</h1>
      </div>

      <PostCard post={post} />

      <div className="pt-6 border-t">
        <h2 className="text-lg font-bold mb-6">Comments</h2>
        <CommentList postId={post.id} postAuthorId={post.author.id} />
      </div>
    </div>
  );
}
