import type { components, operations } from '@/shared/api/generated/openapi.gen';

type Schemas = components['schemas'];

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.
export type Post = Schemas['PostResponse'];

export type PostListResponse = Schemas['PostPageResponse'];

// BE는 게시글 등록 응답으로 PostResponse를 그대로 돌려준다(PostController.kt:28).
export type CreatePostResponse = Post;

// GET /post 의 쿼리 파라미터. page·size는 BE에 기본값이 있어 스펙상 optional이지만
// (PostController.kt `@RequestParam(defaultValue = "0")` 등), FE는 페이지네이션 상태를
// 항상 명시적으로 관리하므로(post.api.ts의 `if (page === 0)` 등) 필수로 좁힌다.
export type PostListRequest = Omit<
  NonNullable<operations['getAllPosts']['parameters']['query']>,
  'page' | 'size'
> & {
  page: number;
  size: number;
};
