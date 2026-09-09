---
name: design-tokens
description: Link-Sphere FE 디자인 토큰(`src/app/globals.css`) 색상·반경·커서·다크모드·폰트 규약. 컴포넌트를 스타일링하거나 색상 클래스를 고를 때 사용.
when_to_use: 컴포넌트에 색상/배경/테두리 클래스를 붙일 때, 클릭 가능한 요소에 커서 스타일이 필요한지 판단할 때, 다크모드·라운딩 값을 정할 때.
paths: src/**/*.tsx
---

2026-09-09, `.claude/CLAUDE.md`가 984줄로 길어져 공식 권장 상한(~200줄)을 크게 넘긴 것을
계기로 CLAUDE.md 본문에서 이 절을 옮겼다 — 매 세션 로드할 필요 없이 스타일링 작업을 할 때만
불러오면 된다. **하드코딩 색상 클래스 사용 금지**라는 원칙 자체는 `.claude/CLAUDE.md`의
"Never" 목록에 남아 있다 — 이 skill은 그 대체 클래스 표를 담고 있다.

## 디자인 토큰 (`src/app/globals.css`)

Tailwind v4 CSS 변수 기반 테마. **하드코딩 색상 클래스 사용 금지** — 아래 의미론적 클래스를 사용한다.

### 주요 색상 토큰 → Tailwind 클래스

| 의미        | CSS 변수        | Tailwind 클래스                             | 사용 예              |
| ----------- | --------------- | ------------------------------------------- | -------------------- |
| 기본 배경   | `--background`  | `bg-background`                             | 페이지 배경          |
| 기본 텍스트 | `--foreground`  | `text-foreground`                           | 본문 텍스트          |
| 카드        | `--card`        | `bg-card`, `text-card-foreground`           | Card 컴포넌트        |
| 기본 강조   | `--primary`     | `bg-primary`, `text-primary-foreground`     | 주요 버튼, CTA       |
| 보조        | `--secondary`   | `bg-secondary`, `text-secondary-foreground` | 보조 버튼            |
| 음소거      | `--muted`       | `bg-muted`, `text-muted-foreground`         | 비활성 텍스트, 힌트  |
| 강조        | `--accent`      | `bg-accent`, `text-accent-foreground`       | 호버, 선택 상태      |
| 파괴적 액션 | `--destructive` | `text-destructive`, `bg-destructive`        | 삭제 버튼, 에러 상태 |
| 성공        | `--success`     | `text-success`, `bg-success`                | 완료, 성공 상태      |
| 경고        | `--warning`     | `text-warning`, `bg-warning`                | 주의 상태            |
| 정보        | `--info`        | `text-info`, `bg-info`                      | 안내, 정보 배지      |
| 카테고리    | `--category`    | `bg-category`, `text-category-foreground`   | 카테고리 배지        |
| 테두리      | `--border`      | `border-border`                             | 구분선               |
| 입력        | `--input`       | `border-input`                              | 입력 필드 테두리     |
| 링          | `--ring`        | `ring-ring`                                 | 포커스 링            |

### 반경 토큰

| 토큰          | 클래스       | 값                          |
| ------------- | ------------ | --------------------------- |
| `--radius-sm` | `rounded-sm` | `calc(var(--radius) - 4px)` |
| `--radius-md` | `rounded-md` | `calc(var(--radius) - 2px)` |
| `--radius-lg` | `rounded-lg` | `var(--radius)`             |
| `--radius-xl` | `rounded-xl` | `calc(var(--radius) + 4px)` |

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
