import type { components } from '@/shared/api/generated/openapi.gen';

type Schemas = components['schemas'];

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.
//
// linkMetadata를 override한다 — OpenAPI 3.0 시절에는 "$ref는 형제 키를 가질 수 없다" 제약 때문에
// BE의 nullable 보정(link-sphere_BE_NEW, NullableAwareModelConverter)이 $ref 프로퍼티에서 유실됐다
// (2026-09-20 실측). 3.1 전환(springdoc 2.10.0, FE #419) 뒤로는 스펙이 oneOf [$ref, null]로 싣고
// 생성 타입도 이미 `| null`이라 이 override는 안전한 중복이다 — 일부러 남겨 둔다(docs/OPENAPI-CODEGEN.md
// §11). CommentDTO.kt의 실제 타입은 `linkMetadata: LinkMetadata? = null`이라 런타임엔 null도 undefined도 온다.
//
// replies도 override한다 — Omit은 최상위 키만 제외할 뿐 중첩 타입까지 다시 쓰진 않아서,
// 그대로 두면 replies가 원본 CommentResponse[](3.0 시절엔 linkMetadata에 null이 없던 버전)를
// 그대로 참조해 재귀 지점마다 위 override가 끊겼다.
export type Comment = Omit<Schemas['CommentResponse'], 'linkMetadata' | 'replies'> & {
  linkMetadata?: Schemas['LinkMetadata'] | null;
  replies: Comment[];
};

export type MyComment = Schemas['MyCommentResponse'];
export type MyCommentListResponse = Schemas['MyCommentPageResponse'];
