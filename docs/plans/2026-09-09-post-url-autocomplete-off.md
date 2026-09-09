# 포스트 등록·수정 폼 URL 필드의 브라우저 자동완성 끄기

## Context

포스트 등록/수정 폼의 URL 입력란을 클릭하면 브라우저가 드롭다운으로 이전 입력값들을 제안한다.
원인은 방문 히스토리가 아니라 **폼 자동완성 기록(form autofill history)** 이다 — 브라우저는 폼이
제출될 때 각 필드의 `name`(여기선 `url`)과 입력값을 저장해두고, 같은 `name`의 필드에 포커스가
가면 저장된 값들을 제안한다.

링크를 등록·수정할 때 사용자는 거의 항상 새 URL을 붙여넣기 때문에 이 제안은 도움이 되지 않고,
입력란 아래 영역을 가려 방해만 된다. HTML `autocomplete` 속성으로 브라우저에 "이 필드는 저장·
제안하지 말라"고 알려 끈다.
(스펙: [MDN — HTML attribute: autocomplete](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/autocomplete))

**적용 범위**(2026-09-09 사용자 확인): 등록 폼과 수정 폼의 **URL 필드 두 곳만**. 두 폼이 같은
`name="url"`을 쓰므로 자동완성 기록도 공유된다 — 한쪽만 끄면 다른 쪽에서 계속 뜬다. `title`
필드와 검색창(`SearchInput`)은 이번 범위 밖.

## 변경 내용

props 전달 체인은 `CreatePostForm`/`UpdatePostForm` → `FormInput` → `Input` → 네이티브
`<input>`이고, 중간 어디에도 props를 걸러내는 지점이 없다(모두 `{...props}` spread). 따라서
**호출부에 속성 한 줄씩, 총 2줄 추가**로 끝난다. 공통 컴포넌트(`shared/ui/`)는 건드리지 않는다
— 스토리 갱신 규칙(`.claude/CLAUDE.md`)도 해당 없음.

### 1. `src/features/post/create/ui/CreatePostForm.tsx:37-42`

```tsx
<FormInput
  name="url"
  label="URL"
  placeholder={TEXTS.post.form.create.urlPlaceholder}
  autoComplete="off"
  required
/>
```

### 2. `src/features/post/update/ui/UpdatePostForm.tsx:44-50`

```tsx
<FormInput
  name="url"
  label={TEXTS.post.form.update.urlLabel}
  placeholder={TEXTS.post.form.update.urlPlaceholder}
  description={isUrlChanged ? TEXTS.post.form.update.urlChangedNotice : undefined}
  autoComplete="off"
  required
/>
```

`autoComplete`는 마지막 서술 prop 자리(=`required` 바로 위)에 넣어 기존 prop 나열 순서(name →
label → placeholder → description → 플래그)를 그대로 따른다.

### 3. `CHANGELOG.md` `[Unreleased]` → `### Fixed`

사용자가 체감하는 동작 변경이므로 `.claude/CLAUDE.md`의 CHANGELOG 규칙에 따라 같은 커밋에 포함한다.

```markdown
- `post` 링크 등록·수정 폼 URL 입력란의 브라우저 자동완성 제안 비활성화
  <details><summary>배경·구현</summary>

  URL 입력란에 포커스하면 브라우저가 폼 자동완성 기록(이전에 제출한 URL들)을 드롭다운으로 제안해 아래 필드를 가렸다. 링크 등록·수정은 매번 새 URL을 붙여넣는 흐름이라 제안이 도움이 되지 않아 `autoComplete="off"`로 끈다. 두 폼이 같은 `name="url"`을 써서 자동완성 기록을 공유하므로 양쪽 모두에 적용했다. (`features/post/create/ui/CreatePostForm.tsx`, `features/post/update/ui/UpdatePostForm.tsx`)

  </details>
```

> 상세 블록 안 문단은 **한 줄로** 쓴다(손으로 줄바꿈하면 Prettier가 non-idempotent 상태가 되어
> CI `pnpm check`에서 걸린다 — `.claude/CLAUDE.md` CHANGELOG 규칙).
> PR 생성 후 파일 목록 괄호 끝에 `[PR #NN](URL)`을 덧붙이는 후속 커밋을 별도로 push한다.

## 작업 절차

1. `git log origin/main..main` — 미푸시 커밋 확인 후 `EnterWorktree`로 워크트리 생성
2. 워크트리 부트스트랩: `cp ../../../.env .` && `pnpm install`
3. 위 3개 파일 수정
4. 검증(아래) → `git commit -- <경로...>` (스테이징 금지) → PR

## 검증

```bash
pnpm type-check      # 필수
pnpm lint            # ESLint
pnpm test            # 기존 테스트 회귀 확인 (CreatePostForm 관련 테스트 존재)
pnpm format:check    # CHANGELOG를 건드리므로 lint만으로는 부족
```

**실제 동작 확인**(이 변경의 본체는 브라우저 동작이라 정적 검사만으로는 검증되지 않는다):

1. `pnpm dev` → 링크 등록 페이지에서 URL을 입력하고 **제출**한다(자동완성 기록은 제출 시점에
   저장되므로, 저장된 기록이 이미 있어야 재현이 된다).
2. 다시 등록 페이지에 들어가 URL 입력란을 클릭 → 드롭다운이 뜨지 않아야 한다.
3. 수정 페이지에서도 같은 방식으로 확인한다.
4. 대조군: 바로 아래 `title` 입력란은 이번 범위 밖이므로 **여전히 자동완성이 떠야 한다**
   (속성이 실제로 필드 단위로 먹었다는 증거).

**만약 여전히 뜬다면** — Chrome은 필드 `name`을 휴리스틱으로 특정 autofill 카테고리에 매칭했을
때 `autocomplete="off"`를 무시하는 경우가 있다(문서화된 동작). 그 경우 회피책은 별도 판단이
필요하므로 임의로 우회 트릭(더미 필드, 난수 `name` 등)을 넣지 않고 결과를 보고한 뒤 다시 상의한다.

## 회귀 영향 점검

- **CRUD**: 이 속성은 브라우저 UI 힌트일 뿐 폼 값·제출 payload·검증에 관여하지 않는다. 포스트
  등록/수정 API 계약 변화 없음.
- **기존 테스트**: jsdom은 autofill을 구현하지 않으므로 `autoComplete` 추가가 테스트에 영향을
  주지 않는다. `features/post/create/ui/PostCreateBookmarkFolderField.test.tsx` 등 기존 테스트는
  URL 필드의 값 입력/제출만 다루므로 그대로 통과할 것 — `pnpm test`로 확인한다.
- **접근성**: `autocomplete="off"`는 스크린리더 동작이나 label 연결(`FormField`의 `htmlFor` ↔
  `Input`의 `id`)에 영향을 주지 않는다.
- **문서**: 이 동작을 서술하는 기능 문서 없음(`docs/`에 포스트 등록 폼 전용 문서 부재).
  `CHANGELOG.md`만 갱신 대상.

## 범위 밖 (건드리지 않음)

- 레포 전체에 `autoComplete` 사용처가 0건이라, `features/auth/`의 로그인·회원가입 비밀번호
  필드에도 `current-password`/`new-password` 힌트가 없다 — 비밀번호 관리자 연동 품질에 영향을
  주지만 이번 요청 범위 밖이므로 **언급만 하고 손대지 않는다**.
- `SearchInput`, `title` 필드의 자동완성.
