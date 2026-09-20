import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/comment.const';

// 댓글은 이미지만 있고 본문이 비어도 정상이라 content: min(1) 같은 필수 검증을 상속하지
// 않는다 - 작성/수정 폼이 공유하는 유일한 검증은 바이트 상한이다.
export const commentContentFormSchema = z.object({
  content: z
    .string()
    .refine(
      (value) => getUtf8ByteLength(value) <= MAX_COMMENT_CONTENT_BYTES,
      TEXTS.validation.commentContentTooLong
    ),
});

export type CommentContentFormValues = z.infer<typeof commentContentFormSchema>;

// 기존 import 경로 호환 — 응답 타입은 dto.ts(BE 스펙 생성)에서 가져간다.
export type {
  Comment,
  MyComment,
  MyCommentListResponse,
} from '@/entities/comment/model/comment.dto';
