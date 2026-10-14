import type { components } from '@/shared/api/generated/openapi.gen';
import type { Unwrap } from '@/shared/api/api.type';

type Schemas = components['schemas'];

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.

// PUT/DELETE /post/{postId}/like 응답 — 요청한 상태와 그 뒤의 좋아요 수
export type PostLikeResponse = Schemas['PostLikeResponse'];

// PUT/DELETE /comment/{commentId}/like 응답({ isLiked }) — BE가 Map으로 내려 이름 없는 스키마다
export type CommentLikeResponse = Unwrap<'ApiResponseMapStringBoolean'>;

// PUT/DELETE /post/{postId}/bookmark 응답 — 요청한 상태와 서버의 실제 폴더 소속(PUT은 기존 소속을 유지한다)
export type PostBookmarkResponse = Schemas['BookmarkFoldersResponse'];
