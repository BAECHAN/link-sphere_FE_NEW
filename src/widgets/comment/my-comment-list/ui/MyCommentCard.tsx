import { Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { MyComment } from '@/entities/comment/model/comment.schema';
import { Card } from '@/shared/ui/atoms/card';
import { DateUtil } from '@/shared/utils/date.util';

interface MyCommentCardProps {
  comment: MyComment;
}

/**
 * 댓글 내용을 먼저 보여주고 원글은 하단 배지로 낮춰 배치한다 - "내가 뭐라고 썼는지"를
 * 찾는 화면의 목적에 맞춘 선택(사용자 확인, 아티팩트 비교 후 2안 채택).
 * 클릭하면 원글의 그 댓글 위치로 스크롤·하이라이트된다 (PostDetailPage 참고).
 */
export function MyCommentCard({ comment }: MyCommentCardProps) {
  return (
    <Link to={`/post/${comment.postId}#comment-${comment.id}`} className="block">
      <Card className="p-3 gap-2 hover:shadow-md transition-shadow">
        <p className="text-sm text-foreground leading-relaxed line-clamp-3">{comment.content}</p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5 min-w-0 font-medium text-info">
            <Link2 className="size-3.5 shrink-0" />
            <span className="truncate">{comment.postTitle}</span>
          </span>
          <span className="shrink-0">{DateUtil.formatRelativeShort(comment.createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
