import { Comment } from '@/entities/comment/model/comment.schema';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';
import { Badge } from '@/shared/ui/atoms/badge';
import { DateUtil } from '@/shared/utils/date.util';
import { useState } from 'react';
import { LikeCommentButton } from '@/features/comment/like/ui/LikeCommentButton';
import { CommentForm } from '@/features/comment/create/ui/CommentForm';
import { CommentEditForm } from '@/features/comment/update/ui/CommentEditForm';
import { MessageSquare, Trash2, Edit2 } from 'lucide-react';
import { useFetchAccountQuery } from '@/entities/user/api/auth.queries';
import { cn } from '@/shared/lib/tailwind/utils';
import { ActionButton } from '@/shared/ui/elements/ActionButton';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { useUpdateComment } from '@/features/comment/update/hooks/useUpdateComment';
import { useDeleteComment } from '@/features/comment/delete/hooks/useDeleteComment';

interface CommentItemProps {
  comment: Comment;
  postId: string;
  postAuthorId: string;
  depth?: number;
}

export function CommentItem({ comment, postId, postAuthorId, depth = 0 }: CommentItemProps) {
  const { data: account } = useFetchAccountQuery();
  const isMobile = useIsMobile();
  const [isReplying, setIsReplying] = useState(false);

  const {
    isEditing,
    editContent,
    editImagePreviewUrls,
    isUpdating,
    canSubmit,
    setEditContent,
    startEditing,
    cancelEditing,
    handleEditPaste,
    clearEditImage,
    handleUpdate,
  } = useUpdateComment({ comment, postId });

  const { onDelete } = useDeleteComment({ postId });

  const isOwner = account?.id === comment.author.id;
  const isPostAuthor = comment.author.id === postAuthorId;
  const isDeleted = comment.isDeleted;
  const canReply = depth < 1 && !isDeleted;

  return (
    <div className={cn('group flex gap-3 text-sm animate-in fade-in', depth > 0 && 'ml-8 mt-4')}>
      <UserAvatar
        image={comment.author.image}
        nickname={comment.author.nickname}
        className="shrink-0"
      />

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{comment.author.nickname}</span>
          {isPostAuthor && (
            <Badge variant="default" className="px-1.5 py-0 text-[10px] h-4 bg-category">
              작성자
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {DateUtil.formatRelativeShort(comment.createdAt)}
          </span>
        </div>

        {isEditing ? (
          <CommentEditForm
            editContent={editContent}
            editImagePreviewUrls={editImagePreviewUrls}
            isUpdating={isUpdating}
            canSubmit={canSubmit}
            isMobile={isMobile}
            setEditContent={setEditContent}
            cancelEditing={cancelEditing}
            handleEditPaste={handleEditPaste}
            clearEditImage={clearEditImage}
            handleUpdate={handleUpdate}
          />
        ) : (
          <MarkdownContent
            content={comment.content}
            isMobile={isMobile}
            className={cn('text-foreground', isDeleted && 'text-muted-foreground italic')}
          />
        )}

        {!isDeleted && (
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <LikeCommentButton
              commentId={comment.id}
              postId={postId}
              isLiked={comment.isLiked}
              likeCount={comment.likeCount}
            />

            {canReply && (
              <ActionButton
                icon={MessageSquare}
                label="답글 달기"
                onClick={() => setIsReplying(!isReplying)}
                className="hover:text-info"
              />
            )}

            {isOwner && (
              <>
                <ActionButton
                  icon={Edit2}
                  label="수정"
                  onClick={startEditing}
                  className="hover:text-info"
                />
                <ActionButton
                  icon={Trash2}
                  label="삭제"
                  onClick={() => onDelete(comment.id)}
                  className="hover:text-destructive"
                />
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

        {comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                postId={postId}
                postAuthorId={postAuthorId}
                depth={depth + 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
