import type { components, operations } from '@/shared/api/generated/openapi.gen';

type Schemas = components['schemas'];

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.
export type Post = Schemas['PostResponse'];

export type PostListResponse = Schemas['PostPageResponse'];

// BE는 게시글 등록 응답으로 PostResponse를 그대로 돌려준다(PostController.kt:28).
export type CreatePostResponse = Post;

// 작성 중 링크 미리보기(GET /link-preview). 결과는 BE가 10분 캐시해 같은 URL로 등록할 때 재사용한다.
export type LinkPreview = Schemas['LinkPreviewResponse'];

// 조회 기록(POST /post/{id}/view) 응답. viewCount는 BE가 이번 조회를 셀지 판단한 뒤의 조회수다.
export type PostViewRecord = Schemas['PostViewRecordResponse'];

// GET /post 의 쿼리 파라미터. size는 BE에 기본값이 있어 스펙상 optional이지만 FE는 쪽 크기를 항상
// 정해서 보내므로 필수로 좁힌다. page는 옛 번들을 위해 스펙에 남아 있는 옛 경로라 FE에서 쓰지 못하게 뺀다.
export type PostListRequest = Omit<
  NonNullable<operations['getAllPosts']['parameters']['query']>,
  'page' | 'size'
> & {
  size: number;
};
