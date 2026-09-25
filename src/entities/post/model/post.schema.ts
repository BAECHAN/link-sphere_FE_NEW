import { z } from 'zod';
import { TEXTS } from '@/shared/config/texts';
import { UrlUtil } from '@/shared/utils/url.util';

// 여기 있는 건 전부 "사용자 입력 검증"이다. 서버 응답 형태의 정본은 post.dto.ts(BE 스펙
// 생성) 다.
// BE SafeUrlValidator가 http/https 스킴만 크롤링 대상으로 허용해, file:// 등은 형식은
// 유효해도 등록은 항상 실패한다 — 요청을 보내기 전에 클라이언트에서 먼저 걸러낸다.
const postUrlSchema = z
  .string()
  .url(TEXTS.validation.urlFormat)
  .refine((value) => /^https?:\/\//.test(UrlUtil.normalizeUrl(value)), TEXTS.validation.urlFormat);

/**
 * 포스트 등록(생성)을 위한 스키마
 * 사용자가 입력하는 url과 categories만 필수값으로 설정합니다.
 */
export const createPostSchema = z.object({
  url: postUrlSchema,
  title: z.string().optional(),
  categoryIds: z.array(z.coerce.number()).optional(),
  isPrivate: z.boolean(),
  // 폴더 없이 북마크만(미분류)
  bookmark: z.boolean(),
  // 소속시킬 폴더들
  folderIds: z.array(z.string()),
});

export const updatePostSchema = z.object({
  url: postUrlSchema,
  // 제목을 비우면 서버가 링크에서 제목을 다시 가져오므로 비워둘 수 있다.
  title: z.string().optional(),
  categoryIds: z.array(z.coerce.number()).optional(),
  isPrivate: z.boolean(),
});

// ==================== 2. Comment Schema ====================
// Moved to comment.schema.ts

export * from '@/entities/comment/model/comment.schema';

export type CreatePost = z.infer<typeof createPostSchema>;
export type UpdatePost = z.infer<typeof updatePostSchema>;

// 기존 import 경로 호환 — 응답 타입은 dto.ts(BE 스펙 생성)에서 가져간다.
export type {
  Post,
  PostListRequest,
  PostListResponse,
  CreatePostResponse,
} from '@/entities/post/model/post.dto';
