import { Comment } from '@/domains/post/_common/model/comment.schema';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/atoms/avatar';
import { Badge } from '@/shared/ui/atoms/badge';
import { DateUtil } from '@/shared/utils/date.util';
import { useEffect, useState } from 'react';
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
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { MarkdownContent } from '@/domains/post/features/comments/ui/MarkdownContent';

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
  const [editContent, setEditContent] = useState(comment.content);
  const [editPastedImage, setEditPastedImage] = useState<File | null>(null);
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (editPastedImage) {
      const url = URL.createObjectURL(editPastedImage);
      setEditImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setEditImagePreviewUrl(null);
    }
  }, [editPastedImage]);

  const deleteMutation = useDeleteCommentMutation(postId);
  const updateMutation = useUpdateCommentMutation(postId);
  const likeMutation = useLikeMutation(comment.id, postId);

  const isOwner = account?.id === comment.author.id;
  const isPostAuthor = comment.author.id === postAuthorId;
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

  const handleEditPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setEditPastedImage(file);
          e.preventDefault();
          break;
        }
      }
    }
  };

  const handleUpdate = () => {
    if (!editContent.trim() && !editPastedImage) return;
    updateMutation.mutate(
      { commentId: comment.id, content: editContent, image: editPastedImage },
      {
        onSuccess: () => {
          setIsEditing(false);
          setEditPastedImage(null);
        },
      }
    );
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditContent(comment.content);
    setEditPastedImage(null);
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
          {isPostAuthor && (
            <Badge variant="default" className="px-1.5 py-0 text-[10px] h-4 bg-purple-600">
              작성자
            </Badge>
          )}
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
              placeholder="수정할 내용을 입력하세요... (이미지 복사+붙여넣기 가능)"
              autoFocus
              onPaste={handleEditPaste}
            />
            {editContent && (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <p className="text-xs text-muted-foreground mb-1.5">미리보기</p>
                <MarkdownContent content={editContent} isMobile={isMobile} />
              </div>
            )}
            {editImagePreviewUrl && (
              <div className="relative inline-block border border-gray-200 dark:border-gray-800 rounded-md overflow-hidden group">
                <img
                  src={editImagePreviewUrl}
                  alt="Pasted preview"
                  className="max-h-32 object-contain"
                />
                <button
                  type="button"
                  onClick={() => setEditPastedImage(null)}
                  className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="이미지 삭제"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
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
                disabled={(!editContent.trim() && !editPastedImage) || updateMutation.isPending}
                className="h-8 px-2 text-xs"
              >
                <Check className="mr-1 h-3 w-3" />
                {updateMutation.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        ) : (
          <MarkdownContent
            content={comment.content}
            isMobile={isMobile}
            className={cn(
              'text-gray-800 dark:text-gray-200',
              isDeleted && 'text-muted-foreground italic'
            )}
          />
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
