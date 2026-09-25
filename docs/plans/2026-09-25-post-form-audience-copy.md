# 링크 등록 화면 "팀원들" 문구 수정

## Context

`/post/submit` 설명 문구가 _"팀원들과 공유하고 싶은…"_ 으로 되어 있지만, 이 서비스는 팀 전용이
아니다 — 피드(`/post`)·상세(`/post/:id`)는 비로그인 사용자도 열람 가능한 공개 영역이다
(`src/app/routes/index.tsx:99-116`). 같은 잘못된 전제("팀원들에게 공유되지 않고")가
"나만 보기" 체크박스 설명(`privateDescription`, 등록·수정 화면 공통)에도 있다.

사용자 확정 사항(2026-09-25):

- description1: 공유 대상을 아예 뺀다(같은 폼에 "나만 보기" 옵션이 있어 대상 명시가 비공개 등록과 충돌)
- privateDescription: 함께 고친다

## 변경 내용

`src/shared/config/texts.ts` 2줄만 수정한다.

| 키                                    | 위치           | 변경 전                                                                  | 변경 후                                                                     |
| ------------------------------------- | -------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `POST_FORM_COMMON.privateDescription` | `texts.ts:23`  | `'체크하면 팀원들에게 공유되지 않고 나만 볼 수 있는 게시물로 저장돼요.'` | `'체크하면 다른 사람에게 공개되지 않고 나만 볼 수 있는 게시물로 저장돼요.'` |
| `post.form.create.description1`       | `texts.ts:146` | `'팀원들과 공유하고 싶은 유용한 아티클이나 리소스의 URL을 입력하세요.'`  | `'공유하고 싶은 유용한 아티클이나 리소스의 URL을 입력하세요.'`              |

- 사용처: `CreatePostForm.tsx:29`, `:61` / `UpdatePostForm.tsx:68` — 컴포넌트 코드는 안 건드림
- 두 문구 모두 해요체 유지(`texts-conventions` 톤 규칙, `texts.test.ts` 가드 대상)
- `CHANGELOG.md` `[Unreleased]`에 `### Fixed` 항목 추가(`changelog-release` skill 포맷)

## 영향 범위 점검

- 이 문자열을 단정하는 테스트·e2e·스토리·문서 없음(grep 확인) → 회귀 테스트 깨질 곳 없음
- 데이터 계약·API·캐시 변경 없음 — 순수 UI 문구

## 진행 순서

1. `git log origin/main..main`으로 미푸시 커밋 확인 → `EnterWorktree` → `cp ../../../.env . && pnpm install`
2. `texts.ts` 2줄 수정 + `CHANGELOG.md` 항목 추가
3. 이 계획을 `docs/plans/2026-09-25-post-form-audience-copy.md`로 복사(§11)
4. 검증(아래) → `git commit -- <경로...>`로 `fix(post): ...` 단일 커밋
5. fresh Explore subagent로 계획 대비 diff 대조 → PR 본문 `## 계획 대비 구현` 섹션 → PR 생성
6. 병합은 사용자 확인 후 squash, 병합 뒤 배포 워크플로우 성공 확인까지

## 검증

- `pnpm type-check`
- `pnpm test` — 특히 `src/shared/config/texts.test.ts`(해요체 가드) 통과 확인
- `pnpm lint`
- 브라우저 녹화는 생략 — 동작 변화 없는 문구 교체라 `browser-verification` 대상 아님(원하면 `/post/submit` 스크린샷만 추가)
