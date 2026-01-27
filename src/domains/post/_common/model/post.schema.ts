import { z } from 'zod';
import { POST_CATEGORY_OPTIONS } from '@/domains/post/_common/config/const';

/**
 * DB의 posts 테이블 스키마를 기반으로 한 Zod 스키마입니다.
 */
export const postSchema = z.object({
  id: z.string().uuid('유효하지 않은 ID 형식입니다.'),
  user_id: z.string().uuid('유효하지 않은 사용자 ID 형식입니다.'),
  url: z.string().url('유효하지 않은 URL 형식입니다.'),
  title: z.string().min(1, '제목을 입력해주세요.'),
  description: z.string().nullable(),
  tags: z.array(z.string()).nullable(),
  categories: z.array(z.enum(POST_CATEGORY_OPTIONS as [string, ...string[]])).nullable(),
  og_image: z.string().url('유효하지 않은 이미지 URL입니다.').nullable(),
  ai_summary: z.string().nullable(),
  view_count: z.number().int().nonnegative().default(0),
  created_at: z.coerce.date(),
});

/**
 * 포스트 데이터 타입
 */
export type Post = z.infer<typeof postSchema>;

/**
 * 포스트 등록(생성)을 위한 스키마
 * 사용자가 입력하는 url과 categories만 필수값으로 설정합니다.
 */
export const createPostSchema = postSchema.pick({ url: true, categories: true });

export type CreatePost = z.infer<typeof createPostSchema>;

export const createPostResponseDataSchema = postSchema.pick({
  id: true,
  user_id: true,
  url: true,
  title: true,
  description: true,
  tags: true,
  categories: true,
  og_image: true,
  ai_summary: true,
  view_count: true,
  created_at: true,
});

export type CreatePostResponse = z.infer<typeof createPostResponseDataSchema>;
