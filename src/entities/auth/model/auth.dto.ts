import type { components } from '@/shared/api/generated/openapi.gen';

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.
//
// POST /auth/login, POST /auth/refresh 둘 다 이 스키마를 그대로 반환한다
// (openapi.json paths."/auth/login"."post", paths."/auth/refresh"."post" 확인).
//
// deletionCancelled를 override한다 — BE PR #48(link-sphere_BE_NEW, 회원탈퇴 14일 유예기간)이
// 로그인 응답 TokenResponse에 이 필드를 추가했지만, 운영 배포 전이라 생성 스펙(pnpm codegen이
// 읽는 운영 /api/v3/api-docs)에는 아직 반영되지 않았다. 배포 후 codegen을 다시 돌리면 원본
// 스펙에 실제로 생기므로 이 override는 자연히 no-op이 된다 - 그때 지워도 되고 안 지워도 된다.
export type LoginResponse = components['schemas']['TokenResponse'] & {
  deletionCancelled?: boolean;
};
