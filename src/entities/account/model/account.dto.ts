import type { components } from '@/shared/api/generated/openapi.gen';

// BE 스펙(src/shared/api/generated/openapi.json)에서 생성된 타입에 이 레포의 도메인
// 이름을 붙이는 얇은 alias 레이어다. 생성 파일을 직접 import하는 곳은 엔티티당 이 파일
// 하나뿐이라, 스펙 스키마 이름이 바뀌어도 고칠 자리가 한 곳이다.
//
// role: BE가 role을 enum class가 아니라 String으로 선언해(AuthDTO.kt:37
// `val role: String = "USER"`) 스펙에 enum이 실리지 않는다. BE를 enum class로 바꾸기
// 전까지 FE에서 좁힌다. 이 근거 주석을 지우지 말 것.
//
// nickname: 스펙은 optional + nullable이다(AuthDTO.kt:36 `val nickname: String? = null`).
// 그런데 계정을 만드는 유일한 경로인 SignupRequest.nickname은 @NotBlank 필수라(같은 파일
// 27줄) 실제로 존재하는 계정은 전부 nickname을 갖는다 — Kotlin의 nullable 기본값은
// DTO 재사용을 위한 방어적 선언일 뿐 실제 도달 가능한 상태가 아니다. 필수로 좁히지 않고
// 그대로 두면 댓글/게시글 작성자 등 nickname을 필수로 요구하는 다른 타입들(CommentAuthor,
// UserSummary 등)에 값을 전달하는 곳마다 무의미한 `?? ''` 폴백이 번진다(실제로 type-check가
// 10곳 넘게 잡아냈다, 2026-09-20). role과 같은 이유로 좁힌다.
export type Account = Omit<components['schemas']['AccountResponse'], 'role' | 'nickname'> & {
  role: 'USER' | 'ADMIN';
  nickname: string;
};
