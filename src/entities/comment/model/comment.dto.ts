import type { components } from '@/shared/api/generated/openapi.gen';

type Schemas = components['schemas'];

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.
//
// linkMetadata를 override한다 — $ref로 참조되는 프로퍼티는 OpenAPI 3.0의 "$ref는 형제 키를
// 가질 수 없다" 제약 때문에 BE의 nullable 보정 ModelConverter(link-sphere_BE_NEW,
// NullableAwareModelConverter)가 붙인 nullable:true가 직렬화 과정에서 유실된다(원시 타입
// 프로퍼티에는 적용되지만 $ref 프로퍼티에는 안 됨 - 2026-09-20 실측). CommentDTO.kt의 실제
// 타입은 `linkMetadata: LinkMetadata? = null`이라 런타임엔 null도 undefined도 온다.
//
// replies도 override한다 — Omit은 최상위 키만 제외할 뿐 중첩 타입까지 다시 쓰진 않아서,
// 그대로 두면 replies가 원본 CommentResponse[](linkMetadata에 null이 없는 버전)를 그대로
// 참조해 재귀 지점마다 위 override가 끊긴다.
export type Comment = Omit<Schemas['CommentResponse'], 'linkMetadata' | 'replies'> & {
  linkMetadata?: Schemas['LinkMetadata'] | null;
  replies: Comment[];
};

export type MyComment = Schemas['MyCommentResponse'];
export type MyCommentListResponse = Schemas['MyCommentPageResponse'];
