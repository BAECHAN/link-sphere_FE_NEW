import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/comment.const';
import { paginationResponseSchema } from '@/shared/types/common.type';

const linkMetadataSchema = z.object({
  url: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  ogImage: z.string().nullable(),
});

export const commentBaseSchema = z.object({
  id: z.string(),
  content: z.string().min(1, TEXTS.validation.contentRequired),
  isDeleted: z.boolean(),
  createdAt: z.coerce.date(),
  author: z.object({
    id: z.string(),
    nickname: z.string(),
    image: z.string().nullable(),
  }),
  likeCount: z.number().int().nonnegative(),
  isLiked: z.boolean(),
  linkMetadata: linkMetadataSchema.nullable().optional(),
});

export type Comment = z.infer<typeof commentBaseSchema> & {
  replies: Comment[];
};

// 댓글은 이미지만 있고 본문이 비어도 정상이라 commentBaseSchema(content: min(1))를 상속하지
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

// "내 댓글" 목록 전용 - 응답에 원글 postId/postTitle이 함께 온다(BE MyCommentResponse).
// commentBaseSchema를 재사용하지 않는 이유: replies가 재귀 타입이라 그 타입을 확장하면
// 목록 아이템에 불필요한 replies 필드가 끼어든다.
export const myCommentSchema = z.object({
  id: z.string(),
  content: z.string(),
  createdAt: z.coerce.date(),
  postId: z.string(),
  postTitle: z.string(),
});

export type MyComment = z.infer<typeof myCommentSchema>;

export const myCommentListResponseSchema = paginationResponseSchema(myCommentSchema);

export type MyCommentListResponse = z.infer<typeof myCommentListResponseSchema>;
