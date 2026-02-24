import { useComments } from '@/domains/post/_common/api/comment.queries';
import { CommentForm } from '@/domains/post/features/comments/ui/CommentForm';
import { CommentItem } from '@/domains/post/features/comments/ui/CommentItem';
import { Comment as PostComment } from '@/domains/post/_common/model/comment.schema';
import { Loader2 } from 'lucide-react';

interface CommentListProps {
  postId: string;
  postAuthorId: string;
}

export function CommentList({ postId, postAuthorId }: CommentListProps) {
  const { data: comments, isLoading, error } = useComments(postId);

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-500 p-4 text-center text-sm">댓글을 불러오는데 실패했습니다.</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold mb-4">댓글</h3>
        <CommentForm postId={postId} />
      </div>

      <div className="space-y-6">
        {comments && comments.length > 0 ? (
          comments.map((comment: PostComment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              postId={postId}
              postAuthorId={postAuthorId}
            />
          ))
        ) : (
          <div className="text-center py-8 text-muted-foreground text-sm">
            첫 번째 댓글을 남겨보세요!
          </div>
        )}
      </div>
    </div>
  );
}
