import { Comment } from '@/domains/post/_common/model/comment.schema';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/atoms/avatar';
import { DateUtil } from '@/shared/utils/date.util';
import { useState } from 'react';
import { useDeleteCommentMutation } from '@/domains/post/_common/api/comment.queries';
import { useLikeCommentMutation as useLikeMutation } from '@/domains/interaction/_common/api/interaction.queries';
import { CommentForm } from '@/domains/post/features/comments/ui/CommentForm';
import { Heart, MessageSquare, Trash2 } from 'lucide-react';
import { useFetchAccountQuery } from '@/domains/auth/_common/api/auth.queries';
import { cn } from '@/shared/lib/tailwind/utils';

interface CommentItemProps {
  comment: Comment;
  postId: string;
  depth?: number;
}

export function CommentItem({ comment, postId, depth = 0 }: CommentItemProps) {
  const { data: account } = useFetchAccountQuery();
  const [isReplying, setIsReplying] = useState(false);

  const deleteMutation = useDeleteCommentMutation(postId);
  const likeMutation = useLikeMutation(comment.id, postId);

  const isOwner = account?.id === comment.author.id;
  const isDeleted = comment.isDeleted;

  // Max depth check: If depth >= 1, cannot reply (UI restriction)
  // Backend enforces Max Depth 1 (Comment -> Reply).
  // So depth 0 can reply. depth 1 cannot.
  const canReply = depth < 1 && !isDeleted;

  const handleDelete = () => {
    if (confirm('정말로 삭제하시겠습니까?')) {
      deleteMutation.mutate(comment.id);
    }
  };

  const handleLike = () => {
    likeMutation.mutate();
  };

  if (isDeleted && comment.replies.length === 0) {
    // If deleted and no replies, usually we hide it or show "deleted".
    // But if backend actually deletes it (hard delete), we won't get it.
    // If backend soft deletes, we get it.
    // Logic: If hard deleted effectively, return null.
    // But if we received it, it means it exists.
    // If content is "Deleted", show placeholder.
    // Actually backend returns "삭제된 댓글입니다." as content.
  }

  return (
    <div className={cn('group flex gap-3 text-sm animate-in fade-in', depth > 0 && 'ml-8 mt-4')}>
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={comment.author.image || ''} />
        <AvatarFallback>{comment.author.nickname?.[0] || '?'}</AvatarFallback>
      </Avatar>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{comment.author.nickname}</span>
          <span className="text-xs text-muted-foreground">
            {DateUtil.formatRelativeShort(comment.createdAt)}
          </span>
        </div>

        <div
          className={cn(
            'text-gray-800 dark:text-gray-200 leading-relaxed',
            isDeleted && 'text-muted-foreground italic'
          )}
        >
          {comment.content}
        </div>

        {!isDeleted && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <button
              onClick={handleLike}
              className={cn(
                'flex items-center gap-1 hover:text-red-500 transition-colors',
                comment.isLiked && 'text-red-500 font-medium'
              )}
            >
              <Heart className={cn('h-3.5 w-3.5', comment.isLiked && 'fill-current')} />
              <span>{comment.likeCount > 0 ? comment.likeCount : '좋아요'}</span>
            </button>

            {canReply && (
              <button
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1 hover:text-blue-500 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>답글 달기</span>
              </button>
            )}

            {isOwner && (
              <button
                onClick={handleDelete}
                className="flex items-center gap-1 hover:text-red-600 transition-colors"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>삭제</span>
              </button>
            )}
          </div>
        )}

        {isReplying && (
          <CommentForm
            postId={postId}
            parentId={comment.id}
            onCancel={() => setIsReplying(false)}
            onSuccess={() => setIsReplying(false)}
            autoFocus
            className="mt-2"
          />
        )}

        {/* Nested Replies */}
        {comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} postId={postId} depth={depth + 1} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
