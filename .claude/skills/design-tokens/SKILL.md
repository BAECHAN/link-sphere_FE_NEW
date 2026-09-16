---
name: design-tokens
description: Link-Sphere FE 디자인 토큰(`src/app/globals.css`) 색상·반경·커서·다크모드·폰트 규약. 컴포넌트를 스타일링하거나 색상 클래스를 고를 때 사용.
when_to_use: 컴포넌트에 색상/배경/테두리 클래스를 붙일 때, 클릭 가능한 요소에 커서 스타일이 필요한지 판단할 때, 다크모드·라운딩 값을 정할 때.
paths: src/**/*.tsx
---

2026-09-09, `.claude/CLAUDE.md`가 984줄로 길어져 [공식 권장 목표치(~200줄)](https://code.claude.com/docs/en/memory)를
크게 넘긴 것을
계기로 CLAUDE.md 본문에서 이 절을 옮겼다 — 매 세션 로드할 필요 없이 스타일링 작업을 할 때만
불러오면 된다. **하드코딩 색상 클래스 사용 금지**라는 원칙 자체는 `.claude/CLAUDE.md`의
"Never" 목록에 남아 있다 — 이 skill은 그 대체 클래스 표를 담고 있다.

## 디자인 토큰 (`src/app/globals.css`)

Tailwind v4 CSS 변수 기반 테마. **하드코딩 색상 클래스 사용 금지** — 아래 의미론적 클래스를 사용한다.

### 주요 색상 토큰 → Tailwind 클래스

| 의미                  | CSS 변수                        | Tailwind 클래스                                           | 사용 예                                                                                       |
| --------------------- | ------------------------------- | --------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 기본 배경             | `--background`                  | `bg-background`                                           | 페이지 배경                                                                                   |
| 기본 텍스트           | `--foreground`                  | `text-foreground`                                         | 본문 텍스트                                                                                   |
| 카드                  | `--card`                        | `bg-card`, `text-card-foreground`                         | Card 컴포넌트                                                                                 |
| 기본 강조             | `--primary`                     | `bg-primary`, `text-primary-foreground`                   | 주요 버튼, CTA                                                                                |
| 보조                  | `--secondary`                   | `bg-secondary`, `text-secondary-foreground`               | 보조 버튼                                                                                     |
| 음소거                | `--muted`                       | `bg-muted`, `text-muted-foreground`                       | 비활성 텍스트, 힌트                                                                           |
| 강조                  | `--accent`                      | `bg-accent`, `text-accent-foreground`                     | 호버, 선택 상태                                                                               |
| 파괴적 액션           | `--destructive`                 | `text-destructive`, `bg-destructive`                      | 삭제 버튼, 에러 상태                                                                          |
| 파괴적 액션 위 텍스트 | `--destructive-foreground`      | `text-destructive-foreground`                             | destructive variant 버튼/배지 글자색                                                          |
| 딤(오버레이)          | `--scrim`, `--scrim-foreground` | `bg-scrim`(테마 무관 검정), `text-scrim-foreground`(흰색) | Dialog·Sidebar 백드롭, ImageViewer 컨트롤 배경. 투명도는 호출부가 `/40`~`/80` 수식자로 정한다 |
| 성공                  | `--success`                     | `text-success`, `bg-success`                              | 완료, 성공 상태                                                                               |
| 경고                  | `--warning`                     | `text-warning`, `bg-warning`                              | 주의 상태                                                                                     |
| 정보                  | `--info`                        | `text-info`, `bg-info`                                    | 안내, 정보 배지                                                                               |
| 카테고리              | `--category`                    | `bg-category`, `text-category-foreground`                 | 카테고리 배지                                                                                 |
| 테두리                | `--border`                      | `border-border`                                           | 구분선                                                                                        |
| 입력                  | `--input`                       | `border-input`                                            | 입력 필드 테두리                                                                              |
| 링                    | `--ring`                        | `ring-ring`                                               | 포커스 링                                                                                     |

### 반경 토큰

| 토큰          | 클래스       | 값                          |
| ------------- | ------------ | --------------------------- |
| `--radius-sm` | `rounded-sm` | `calc(var(--radius) - 4px)` |
| `--radius-md` | `rounded-md` | `calc(var(--radius) - 2px)` |
| `--radius-lg` | `rounded-lg` | `var(--radius)`             |
| `--radius-xl` | `rounded-xl` | `calc(var(--radius) + 4px)` |

### z-index 토큰

`z-\d+` 리터럴을 직접 쓰지 않는다 — 8단계가 이름 없이 흩어져 있다가 `Sidebar.tsx`
드로어 백드롭과 `MobileCommentBar.tsx` 확장 댓글 시트가 값(55)이 겹치는 잠재 충돌이
있었다(`docs/DECISIONS.md` 2026-09-13 참고). ESLint `custom-tailwind/no-raw-z-index`가
새 리터럴 사용을 차단한다.

| 토큰        | 값  | 용도                                    |
| ----------- | --- | --------------------------------------- |
| `z-raised`  | 10  | 카드/폼 내부 오버레이                   |
| `z-hitbox`  | 20  | 드롭 히트박스                           |
| `z-panel`   | 40  | 패널·바 기본                            |
| `z-nav`     | 50  | Navbar / 하단탭바 / FAB                 |
| `z-scrim`   | 55  | 전면 딤 (Sidebar·MobileCommentBar 공유) |
| `z-drawer`  | 60  | 사이드바 패널                           |
| `z-modal`   | 70  | Dialog                                  |
| `z-popover` | 80  | Dropdown / Select / Tooltip             |

Storybook `Shared/UI/Tokens/Design Tokens` 스토리의 `ZIndex`에서 8단계를 시각적으로
확인할 수 있다.

### 타이포그래피 토큰

**스케일 층 + 역할 층 (2026-09-16 추가).** 스케일 값은 당근마켓
[SEED Typography](https://seed-design.io/foundations/typography)의 `$font-size.t1`~`t14`
/ `$line-height.t1`~`t14`를 그대로 옮겼다. 새 컴포넌트는 스케일(`text-t*`)을 직접 쓰지
말고 아래 **역할 토큰**을 우선 고려한다 — 역할에 맞는 게 없을 때만 스케일을 직접 쓴다.
전체 배경·결정 과정은
[`docs/plans/2026-09-16-typography-tokens-a11y-gate.md`](../../../docs/plans/2026-09-16-typography-tokens-a11y-gate.md)
참고.

#### 역할 토큰 (우선 사용)

| 토큰                    | 크기·줄높이·두께        | 용도                                        | 대상 예시                                                                                     |
| ----------------------- | ----------------------- | ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `text-screen-title`     | t7 (20/27) · semibold   | 페이지 최상위 제목 (h1)                     | `MyCommentPage.tsx`, `BookmarkPage.tsx`, `pages/post/index.tsx`                               |
| `text-section-title`    | t6 (18/24) · semibold   | 섹션 제목 (h2)                              | `CommentList.tsx`                                                                             |
| `text-subsection-title` | t4 (14/19) · semibold   | 소제목, 보통 `text-muted-foreground`와 함께 | `MobileFolderList.tsx`                                                                        |
| `text-micro`            | t1 (11/15), 두께 미지정 | 배지·단축키·카운트 같은 최소 라벨           | `NavbarSearch.tsx`(Kbd), `CommentItem.tsx`(배지), `LikePostButton.tsx`/`PostCard.tsx`(카운트) |

`text-micro`만 두께를 토큰에 묶지 않는다 — 호출부 4곳의 기존 두께가 제각각(Kbd는
`font-medium`, 나머지는 미지정 상속)이라 하나로 합치면 그중 승인받지 않은 화면 변화가
생긴다. 나머지 세 토큰은 두께까지 포함하므로 별도로 `font-semibold`/`font-bold`를
같이 쓰지 않는다 — `no-raw-text-size` ESLint 룰이 이 4개 토큰이 있는 요소에 남은
`text-[Npx]` 임의값만 잡고, 이미 뺀 `font-*` 중복까지 잡지는 않는다.

`--text-screen-title`은 두께를 semibold로 통일했다 — 기존 5곳 중 4곳이 이미
semibold였고, `pages/post/index.tsx`만 유일하게 `font-bold` + 데스크톱에서 더 커지는
반응형(`md:text-2xl`)이었다. 이 한 곳만 다른 4곳과 같은 고정 크기·두께로 맞춰
화면이 실제로 바뀌었다(Artifact 미리보기로 사용자 승인, 2026-09-16).

#### 스케일 층 (t1~t14, 역할이 안 맞을 때만)

| 토큰       | 크기             | 줄 높이          | 비고         |
| ---------- | ---------------- | ---------------- | ------------ |
| `text-t1`  | 0.6875rem (11px) | 0.9375rem (15px) |              |
| `text-t2`  | 0.75rem (12px)   | 1rem (16px)      |              |
| `text-t3`  | 0.8125rem (13px) | 1.125rem (18px)  |              |
| `text-t4`  | 0.875rem (14px)  | 1.1875rem (19px) |              |
| `text-t5`  | 1rem (16px)      | 1.375rem (22px)  |              |
| `text-t6`  | 1.125rem (18px)  | 1.5rem (24px)    |              |
| `text-t7`  | 1.25rem (20px)   | 1.6875rem (27px) |              |
| `text-t8`  | 1.375rem (22px)  | 1.875rem (30px)  |              |
| `text-t9`  | 1.5rem (24px)    | 2rem (32px)      |              |
| `text-t10` | 1.625rem (26px)  | 2.1875rem (35px) |              |
| `text-t11` | 1.75rem (28px)   | 2.375rem (38px)  | sm 이상 권장 |
| `text-t12` | 2rem (32px)      | 2.625rem (42px)  | sm 이상 권장 |
| `text-t13` | 2.5rem (40px)    | 3.25rem (52px)   | sm 이상 권장 |
| `text-t14` | 3rem (48px)      | 3.75rem (60px)   | sm 이상 권장 |

폰트 두께는 스케일 층 자체엔 별도 토큰 없음 — SEED medium(500)/bold(700)이 Tailwind
기본 `font-medium`/`font-bold`와 값이 같다. Storybook `Shared/UI/Tokens/Design Tokens`
스토리의 `Typography`에서 스케일 14단계를 시각적으로 확인할 수 있다(역할 토큰은 아직
별도 카탈로그 없음 — 실제 사용처 4파일에서 확인).

### 인터랙션 커서

Tailwind v4 preflight엔 v3에 있던 `button, [role="button"] { cursor: pointer }`가 없다
(`node_modules/tailwindcss/preflight.css`에 cursor 규칙 자체가 없음). 이걸 컴포넌트마다
개별로 `cursor-pointer`를 붙여 메꾸지 않는다 — `globals.css`의 `@layer base`가 아래
대상 전체에 전역으로 적용한다.

| 분류       | 대상                                                                                                              |
| ---------- | ----------------------------------------------------------------------------------------------------------------- |
| 태그       | `button`, `summary`, `select`, `input[type=checkbox\|radio\|file]`                                                |
| ARIA role  | `button`, `link`, `menuitem`, `menuitemcheckbox`, `menuitemradio`, `option`, `tab`, `switch`, `checkbox`, `radio` |
| 형제 label | `[role=checkbox]`/`[role=radio]` 바로 뒤의 `label` (예: `FormCheckbox`)                                           |

`:disabled`/`aria-disabled="true"`/`[data-disabled]`는 제외(비활성 요소는 `default` 유지).
`Button asChild`로 `<button>`이 아닌 요소를 감쌀 땐 `role="button"`을 함께 지정해야
이 규칙이 적용된다. 선택자 전체 목록·예외·shadcn 재생성 시 주의사항은
`docs/FE-ARCHITECTURE.md` "클릭 가능한 요소와 커서 규칙" 섹션, 배경은
`docs/DECISIONS.md`의 2026-09-03 항목 참고.

### 다크 모드

- 모든 토큰은 `.dark` 클래스에서 자동 override — 별도 `dark:` prefix 불필요
- ThemeProvider가 `<html>`에 `.dark` 클래스를 토글

### 폰트

- 기본 폰트: `Pretendard` (가변 폰트, woff2-variations)
- Tailwind: `font-sans` → Pretendard > Inter > sans-serif
