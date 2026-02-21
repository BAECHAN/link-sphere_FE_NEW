import { Comment } from '@/domains/post/_common/model/comment.schema';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/atoms/avatar';
import { DateUtil } from '@/shared/utils/date.util';
import { useState } from 'react';
import {
  useDeleteCommentMutation,
  useUpdateCommentMutation,
} from '@/domains/post/_common/api/comment.queries';
import { useLikeCommentMutation as useLikeMutation } from '@/domains/interaction/_common/api/interaction.queries';
import { CommentForm } from '@/domains/post/features/comments/ui/CommentForm';
import { Heart, MessageSquare, Trash2, Edit2, X, Check } from 'lucide-react';
import { useFetchAccountQuery } from '@/domains/auth/_common/api/auth.queries';
import { cn } from '@/shared/lib/tailwind/utils';
import { Button } from '@/shared/ui/atoms/button';
import { Textarea } from '@/shared/ui/atoms/textarea';

interface CommentItemProps {
  comment: Comment;
  postId: string;
  depth?: number;
}

export function CommentItem({ comment, postId, depth = 0 }: CommentItemProps) {
  const { data: account } = useFetchAccountQuery();
  const [isReplying, setIsReplying] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);

  const deleteMutation = useDeleteCommentMutation(postId);
  const updateMutation = useUpdateCommentMutation(postId);
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

  const handleUpdate = () => {
    if (!editContent.trim()) return;
    updateMutation.mutate(
      { commentId: comment.id, content: editContent },
      {
        onSuccess: () => setIsEditing(false),
      }
    );
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
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

        {isEditing ? (
          <div className="space-y-2">
            <Textarea
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              className="min-h-[80px] text-sm"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancelEdit}
                className="h-8 px-2 text-xs"
              >
                <X className="mr-1 h-3 w-3" />
                취소
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleUpdate}
                disabled={!editContent.trim() || updateMutation.isPending}
                className="h-8 px-2 text-xs"
              >
                <Check className="mr-1 h-3 w-3" />
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap break-all',
              isDeleted && 'text-muted-foreground italic'
            )}
          >
            {comment.content}
          </div>
        )}

        {!isDeleted && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <button
              type="button"
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
                type="button"
                onClick={() => setIsReplying(!isReplying)}
                className="flex items-center gap-1 hover:text-blue-500 transition-colors"
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>답글 달기</span>
              </button>
            )}

            {isOwner && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-1 hover:text-blue-600 transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  <span>수정</span>
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  className="flex items-center gap-1 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>삭제</span>
                </button>
              </>
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
