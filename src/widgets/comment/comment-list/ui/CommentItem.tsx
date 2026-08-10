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
import { TEXTS } from '@/shared/config/texts';
import { ActionButton } from '@/shared/ui/elements/ActionButton';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { LinkThumbnail } from '@/shared/ui/atoms/link-thumbnail';
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
  const [isEditing, setIsEditing] = useState(false);

  const { onDelete } = useDeleteComment({ postId });

  const isOwner = account?.id === comment.author.id;
  const isPostAuthor = comment.author.id === postAuthorId;
  const isDeleted = comment.isDeleted;
  // 서버 응답을 기다리는 동안 목록에 낙관적으로 꽂아 넣은 임시 댓글 - 아직 실제 id가 없어
  // 좋아요/수정/삭제/답글 같은 서버 액션을 걸면 404가 난다.
  const isOptimistic = comment.id.startsWith('temp-');
  const canReply = depth < 1 && !isDeleted && !isOptimistic;

  return (
    <div
      className={cn(
        'group flex gap-3 text-sm animate-in fade-in',
        depth > 0 && 'ml-8 mt-4',
        isOptimistic && 'opacity-60'
      )}
    >
      <UserAvatar
        image={comment.author.image}
        nickname={comment.author.nickname}
        className="shrink-0"
        zoomable
      />

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{comment.author.nickname}</span>
          {isPostAuthor && (
            <Badge variant="default" className="px-1.5 py-0 text-[10px] h-4 bg-category">
              {TEXTS.comment.item.authorBadge}
            </Badge>
          )}
          <span className="text-xs text-muted-foreground">
            {DateUtil.formatRelativeShort(comment.createdAt)}
          </span>
        </div>

        {isEditing ? (
          <CommentEditForm
            comment={comment}
            postId={postId}
            onCancel={() => setIsEditing(false)}
            onSuccess={() => setIsEditing(false)}
          />
        ) : (
          <>
            <MarkdownContent
              content={comment.content}
              isMobile={isMobile}
              className={cn('text-foreground', isDeleted && 'text-muted-foreground italic')}
            />
            {!isDeleted && comment.linkMetadata && (
              <a
                href={comment.linkMetadata.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-2 border rounded-lg overflow-hidden hover:border-primary/50 transition-colors"
                style={{ maxWidth: '400px' }}
              >
                <LinkThumbnail
                  src={comment.linkMetadata.ogImage}
                  alt={comment.linkMetadata.title}
                />
                <div className="p-2 bg-muted/30">
                  <p className="text-xs font-semibold truncate">{comment.linkMetadata.title}</p>
                  {comment.linkMetadata.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                      {comment.linkMetadata.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {comment.linkMetadata.url}
                  </p>
                </div>
              </a>
            )}
          </>
        )}

        {!isDeleted && !isOptimistic && !isEditing && (
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
                label={TEXTS.comment.item.reply}
                onClick={() => setIsReplying(!isReplying)}
                className="hover:text-info"
              />
            )}

            {isOwner && (
              <>
                <ActionButton
                  icon={Edit2}
                  label={TEXTS.comment.item.edit}
                  onClick={() => setIsEditing(true)}
                  className="hover:text-info"
                />
                <ActionButton
                  icon={Trash2}
                  label={TEXTS.buttons.delete}
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
