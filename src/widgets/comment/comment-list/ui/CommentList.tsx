import { CommentForm } from '@/features/comment/create/ui/CommentForm';
import { CommentItem } from '@/widgets/comment/comment-list/ui/CommentItem';
import { Comment as PostComment } from '@/entities/comment/model/comment.schema';
import { useSuspenseComments } from '@/entities/comment/api/comment.queries';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';
import { TEXTS } from '@/shared/config/texts';

interface CommentListProps {
  postId: string;
  postAuthorId: string;
}

function CommentListContent({ postId, postAuthorId }: CommentListProps) {
  const { data: comments } = useSuspenseComments(postId);
  const isEmpty = comments.length === 0;

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

export function CommentList({ postId, postAuthorId }: CommentListProps) {
  return (
    <AsyncBoundary>
      <CommentListContent postId={postId} postAuthorId={postAuthorId} />
    </AsyncBoundary>
  );
}
