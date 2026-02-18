import { z } from 'zod';
import {
  categoryOptionSchema,
  paginationRequestSchema,
  paginationResponseSchema,
} from '@/shared/api/common.schema';
import { TEXTS } from '@/shared/config/texts';
import { accountSchema } from '@/domains/auth/_common/model/auth.schema';

const aiStatusEnum = z.enum(['NONE', 'PENDING', 'COMPLETED', 'FAILED']);

// ==================== 1. Domain Model Schema ====================

/**
 * DB의 posts 테이블 스키마를 기반으로 한 Zod 스키마입니다.
 */
export const postSchema = z.object({
  id: z.string(),
  userId: z.string(),
  url: z.string().url(TEXTS.validation.urlFormat),
  title: z.string().min(1, TEXTS.validation.titleRequired),
  description: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  categories: z.array(categoryOptionSchema).nullable(),
  ogImage: z.string().nullable(),
  aiSummary: z.string().nullable(),
  aiStatus: aiStatusEnum,
  viewCount: z.number().int().nonnegative().default(0),
  isBookmarked: z.boolean().default(false),
  bookmarkCount: z.number().int().nonnegative().default(0),
  isReacted: z.boolean().default(false), // or specific reaction type string if needed
  reactionCount: z.number().int().nonnegative().default(0),
  commentCount: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
  user: accountSchema.pick({
    id: true,
    name: true,
    image: true,
  }),
});

export const postListRequestSchema = paginationRequestSchema.extend({
  search: z.string().optional(),
  category: z.string().optional(),
  filter: z.string().optional(),
});

export const PostListResponseSchema = paginationResponseSchema(postSchema);

/**
 * 포스트 등록(생성)을 위한 스키마
 * 사용자가 입력하는 url과 categories만 필수값으로 설정합니다.
 */
export const createPostSchema = postSchema.pick({ url: true }).extend({
  categoryIds: z.array(z.coerce.number()).optional(),
});

export const createPostResponseSchema = postSchema.pick({
  id: true,
  userId: true,
  url: true,
  title: true,
  description: true,
  tags: true,
  categories: true,
  ogImage: true,
  aiSummary: true,
  aiStatus: true,
  viewCount: true,
  createdAt: true,
});

// ==================== 3. Interaction Schemas ====================

// --- Bookmark ---
export const bookmarkSchema = z.object({
  userId: z.string(),
  postId: z.string(),
  createdAt: z.coerce.date(),
});

// --- Reaction ---
export const reactionTypeEnum = z.enum(['LIKE', 'LOVE', 'CLAP', 'IDEA', 'THINKING']);
export const targetTypeEnum = z.enum(['POST', 'COMMENT']);

export const reactionSchema = z.object({
  userId: z.string(),
  targetId: z.string(),
  targetType: targetTypeEnum,
  reactionType: reactionTypeEnum,
  createdAt: z.coerce.date(),
});

export const createReactionSchema = reactionSchema.pick({
  targetId: true,
  targetType: true,
  reactionType: true,
});

// --- Comment ---
export const commentSchema = z.object({
  id: z.string(),
  postId: z.string(),
  userId: z.string(),
  content: z.string().min(1, '내용을 입력해주세요.'),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const createCommentSchema = commentSchema.pick({
  postId: true,
  content: true,
});

export const updateCommentSchema = commentSchema.pick({
  content: true,
});

export type Bookmark = z.infer<typeof bookmarkSchema>;
export type Reaction = z.infer<typeof reactionSchema>;
export type CreateReaction = z.infer<typeof createReactionSchema>;
export type Comment = z.infer<typeof commentSchema>;
export type CreateComment = z.infer<typeof createCommentSchema>;
export type UpdateComment = z.infer<typeof updateCommentSchema>;

export type Post = z.infer<typeof postSchema>;
export type PostListRequest = z.infer<typeof postListRequestSchema>;
export type PostListResponse = z.infer<typeof PostListResponseSchema>;

export type CreatePost = z.infer<typeof createPostSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;
