import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';
import { getUtf8ByteLength } from '@/shared/lib/content/textBytes';
import { MAX_COMMENT_CONTENT_BYTES } from '@/entities/comment/config/comment.const';

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
