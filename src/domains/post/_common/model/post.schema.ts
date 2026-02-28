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
  stats: z.object({
    viewCount: z.number().int().nonnegative().default(0),
    likeCount: z.number().int().nonnegative().default(0),
    commentCount: z.number().int().nonnegative().default(0),
    bookmarkCount: z.number().int().nonnegative().default(0),
  }),
  userInteractions: z.object({
    isLiked: z.boolean().default(false),
    isBookmarked: z.boolean().default(false),
  }),
  createdAt: z.coerce.date(),
  isPrivate: z.boolean().default(false),
  author: accountSchema.pick({
    id: true,
    nickname: true,
    image: true,
  }),
});

export const postListRequestSchema = paginationRequestSchema.extend({
  search: z.string().optional(),
  category: z.string().optional(),
  filter: z.string().optional(),
  nickname: z.string().optional(),
});

export const PostListResponseSchema = paginationResponseSchema(postSchema);

/**
 * 포스트 등록(생성)을 위한 스키마
 * 사용자가 입력하는 url과 categories만 필수값으로 설정합니다.
 */
export const createPostSchema = z.object({
  url: postSchema.shape.url,
  title: z.string().optional(),
  categoryIds: z.array(z.coerce.number()).optional(),
  isPrivate: z.boolean(),
});

export const updatePostSchema = z.object({
  title: z.string().min(1, TEXTS.validation.titleRequired),
  categoryIds: z.array(z.coerce.number()).optional(),
  isPrivate: z.boolean(),
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
  stats: true,
  createdAt: true,
  isPrivate: true,
});

// ==================== 3. Interaction & Comment Schemas ====================
// Moved to interaction.schema.ts and comment.schema.ts

export * from './interaction.schema';
export * from './comment.schema';

export type Post = z.infer<typeof postSchema>;
export type PostListRequest = z.infer<typeof postListRequestSchema>;
export type PostListResponse = z.infer<typeof PostListResponseSchema>;

export type CreatePost = z.infer<typeof createPostSchema>;
export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;
