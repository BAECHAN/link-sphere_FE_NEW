import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';

const commentBaseSchema = z.object({
  id: z.string(),
  postId: z.string(),
  userId: z.string(),
  content: z.string().min(1, TEXTS.validation.contentRequired),
  isDeleted: z.boolean(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
  author: z.object({
    id: z.string(),
    nickname: z.string(),
    image: z.string().nullable(),
  }),
  likeCount: z.number().int().nonnegative(),
  isLiked: z.boolean(),
});

export type Comment = z.infer<typeof commentBaseSchema> & {
  replies: Comment[];
};

export const commentSchema: z.ZodType<Comment> = commentBaseSchema.extend({
  replies: z.lazy(() => z.array(commentSchema)),
});

export const createCommentSchema = commentBaseSchema.pick({
  content: true,
});

export const updateCommentSchema = commentBaseSchema.pick({
  content: true,
});

export type CreateComment = z.infer<typeof createCommentSchema>;
export type UpdateComment = z.infer<typeof updateCommentSchema>;
