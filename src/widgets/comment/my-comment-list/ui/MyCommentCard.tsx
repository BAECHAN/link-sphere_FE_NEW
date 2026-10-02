import { Link } from 'react-router-dom';
import { ImageIcon, Link2 } from 'lucide-react';
import { MyComment } from '@/entities/comment/model/comment.schema';
import { Card } from '@/shared/ui/atoms/card';
import { DateUtil } from '@/shared/utils/date.util';
import { splitContentImages } from '@/shared/lib/content/imageContent';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';

interface MyCommentCardProps {
  comment: MyComment;
}

/**
 * 댓글 내용을 먼저 보여주고 원글은 하단 배지로 낮춰 배치한다 - "내가 뭐라고 썼는지"를
 * 찾는 화면의 목적에 맞춘 선택(사용자 확인, 아티팩트 비교 후 2안 채택).
 * 클릭하면 원글의 그 댓글 위치로 스크롤·하이라이트된다 (CommentList 참고).
 *
 * BE는 첨부 이미지를 본문 끝에 "한 줄에 URL 하나"로 이어 붙여 저장하므로, 본문을 그대로
 * 그리면 이미지 주소가 글자로 보인다. 텍스트만 꺼내고 이미지는 원글 배지 옆 개수로만
 * 알린다(2026-10-02, 시안 비교 후 개수 표시안 채택 - 카드 높이를 지금과 같게 유지).
 */
export function MyCommentCard({ comment }: MyCommentCardProps) {
  const { text, imageUrls } = splitContentImages(comment.content);
  const imageCount = imageUrls.length;
  const isImageOnly = !text && imageCount > 0;

  return (
    <Link to={`/post/${comment.postId}#comment-${comment.id}`} className="block">
      <Card className="p-3 gap-2 hover:shadow-md transition-shadow">
        <p
          className={cn(
            'text-sm leading-relaxed line-clamp-3',
            isImageOnly ? 'text-muted-foreground italic' : 'text-foreground'
          )}
        >
          {isImageOnly ? TEXTS.comment.myList.imageOnly(imageCount) : text}
        </p>
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-2 min-w-0">
            <span className="inline-flex items-center gap-1.5 min-w-0 font-medium text-info">
              <Link2 className="size-3.5 shrink-0" />
              <span className="truncate">{comment.postTitle}</span>
            </span>
            {imageCount > 0 && (
              <span className="inline-flex items-center gap-1 shrink-0">
                <ImageIcon className="size-3.5" aria-hidden />
                <span aria-hidden>{imageCount}</span>
                <span className="sr-only">{TEXTS.ariaLabels.myCommentImageCount(imageCount)}</span>
              </span>
            )}
          </span>
          <span className="shrink-0">{DateUtil.formatRelativeShort(comment.createdAt)}</span>
        </div>
      </Card>
    </Link>
  );
}
