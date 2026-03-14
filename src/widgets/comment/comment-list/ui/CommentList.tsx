import { CommentForm } from '@/features/comment/create/ui/CommentForm';
import { CommentItem } from '@/widgets/comment/comment-list/ui/CommentItem';
import { Comment as PostComment } from '@/entities/comment/model/comment.schema';
import { Loader2 } from 'lucide-react';
import { useComments } from '@/entities/comment/api/comment.queries';
import { TEXTS } from '@/shared/config/texts';

interface CommentListProps {
  postId: string;
  postAuthorId: string;
}

export function CommentList({ postId, postAuthorId }: CommentListProps) {
  const { data: comments = [], isLoading, error } = useComments(postId);
  const isEmpty = !isLoading && !error && comments.length === 0;

  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-destructive p-4 text-center text-sm">{TEXTS.comment.list.loadError}</div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="border-b pb-6">
        <h3 className="text-lg font-semibold mb-4">{TEXTS.comment.list.heading}</h3>
        <CommentForm postId={postId} />
      </div>

      <div className="space-y-6">
        {!isEmpty ? (
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
            {TEXTS.comment.list.empty}
          </div>
        )}
      </div>
    </div>
  );
}
