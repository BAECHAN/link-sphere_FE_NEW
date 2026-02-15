import { z } from 'zod';
import { categoryOptionSchema, paginationResponseSchema } from '@/shared/api/common.schema';

const aiStatusEnum = z.enum(['NONE', 'PENDING', 'COMPLETED', 'FAILED']);

/**
 * DB의 posts 테이블 스키마를 기반으로 한 Zod 스키마입니다.
 */
export const postSchema = z.object({
  id: z.string(),
  userId: z.string(),
  url: z.string(),
  title: z.string().min(1, '제목을 입력해주세요.'),
  description: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  categories: z.array(categoryOptionSchema).nullable(),
  ogImage: z.string().nullable(),
  aiSummary: z.string().nullable(),
  aiStatus: aiStatusEnum,
  viewCount: z.number().int().nonnegative().default(0),
  createdAt: z.coerce.date(),
});

/**
 * 포스트 데이터 타입
 */
export type Post = z.infer<typeof postSchema>;

/**
 * 포스트 등록(생성)을 위한 스키마
 * 사용자가 입력하는 url과 categories만 필수값으로 설정합니다.
 */
export const createPostSchema = postSchema.pick({ url: true }).extend({
  categoryIds: z.array(z.coerce.number()).optional(),
});

export type CreatePost = z.infer<typeof createPostSchema>;

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

export type CreatePostResponse = z.infer<typeof createPostResponseSchema>;

/**
 * 포스트 목록 페이지네이션 응답 스키마
 */
export const PostListResponseSchema = paginationResponseSchema(postSchema);

export type PostListResponse = z.infer<typeof PostListResponseSchema>;
