# 디자인 토큰 표

> `pnpm tokens`가 [`packages/ui/tokens/`](../packages/ui/tokens/)의 원본에서 만든 파일이다. 직접 고치지 않는다.

공용 UI 패키지(`@baechan/ui`)의 범용 토큰 100개와 값을 정한 이유다.
앱 전용 토큰(카테고리·차트·사이드바 등)은 [`src/app/globals.css`](../src/app/globals.css)에 있고 이 표에 없다.
원본과 생성물이 어떻게 이어지는지, 값을 고치는 순서는
[`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) §5 "토큰 원본과 생성물"에 있다.
rem 옆의 px는 브라우저 기본 글자 크기(16px)일 때의 값이다.

## 팔레트

무채색 팔레트(원시 층). 의미 색(color)이 무채색 값을 숫자 대신 이 토큰으로 가리킨다. 값은 Tailwind 기본 neutral 팔레트와 같지만, Tailwind 버전이 팔레트를 바꿔도 테마가 따라 바뀌지 않도록 직접 정의한다. 실제로 가리키는 단계만 둔다. 모드와 무관해 다크에서 다시 정하지 않는다. Tailwind 테마 키로 내보내지 않아 팔레트 이름의 유틸리티 클래스는 생기지 않는다(부품은 의미 색만 쓴다). 유채색은 2026-10-29에 숫자로 두기로 했다(docs/DESIGN-SYSTEM.md §5).

원본: [`palette.tokens.json`](../packages/ui/tokens/palette.tokens.json)

| 이름          | CSS 변수                | 값                 |
| ------------- | ----------------------- | ------------------ |
| `white`       | `--palette-white`       | `oklch(1 0 0)`     |
| `neutral-50`  | `--palette-neutral-50`  | `oklch(0.985 0 0)` |
| `neutral-100` | `--palette-neutral-100` | `oklch(0.97 0 0)`  |
| `neutral-200` | `--palette-neutral-200` | `oklch(0.922 0 0)` |
| `neutral-400` | `--palette-neutral-400` | `oklch(0.708 0 0)` |
| `neutral-500` | `--palette-neutral-500` | `oklch(0.556 0 0)` |
| `neutral-800` | `--palette-neutral-800` | `oklch(0.269 0 0)` |
| `neutral-900` | `--palette-neutral-900` | `oklch(0.205 0 0)` |
| `neutral-950` | `--palette-neutral-950` | `oklch(0.145 0 0)` |
| `black`       | `--palette-black`       | `oklch(0 0 0)`     |

## 의미 색

의미 색(라이트). shadcn/ui 이름을 쓴다. Tailwind 색 이름으로 내보내 bg-primary, text-muted-foreground 같은 클래스가 된다. 다크에서 달라지는 값은 color.dark.tokens.json에 있다.

원본: [`color.tokens.json`](../packages/ui/tokens/color.tokens.json), [`color.dark.tokens.json`](../packages/ui/tokens/color.dark.tokens.json)

| 이름                     | CSS 변수                   | 라이트                                       | 다크                                         | 설명                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------ | -------------------------- | -------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `background`             | `--background`             | `--palette-white` → `oklch(1 0 0)`           | `--palette-neutral-950` → `oklch(0.145 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `foreground`             | `--foreground`             | `--palette-neutral-950` → `oklch(0.145 0 0)` | `--palette-neutral-50` → `oklch(0.985 0 0)`  |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `card`                   | `--card`                   | `--palette-white` → `oklch(1 0 0)`           | `--palette-neutral-900` → `oklch(0.205 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `card-foreground`        | `--card-foreground`        | `--palette-neutral-950` → `oklch(0.145 0 0)` | `--palette-neutral-50` → `oklch(0.985 0 0)`  |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `popover`                | `--popover`                | `--palette-white` → `oklch(1 0 0)`           | `--palette-neutral-900` → `oklch(0.205 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `popover-foreground`     | `--popover-foreground`     | `--palette-neutral-950` → `oklch(0.145 0 0)` | `--palette-neutral-50` → `oklch(0.985 0 0)`  |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `primary`                | `--primary`                | `--palette-neutral-900` → `oklch(0.205 0 0)` | `--palette-neutral-200` → `oklch(0.922 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `primary-foreground`     | `--primary-foreground`     | `--palette-neutral-50` → `oklch(0.985 0 0)`  | `--palette-neutral-900` → `oklch(0.205 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `secondary`              | `--secondary`              | `--palette-neutral-100` → `oklch(0.97 0 0)`  | `--palette-neutral-800` → `oklch(0.269 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `secondary-foreground`   | `--secondary-foreground`   | `--palette-neutral-900` → `oklch(0.205 0 0)` | `--palette-neutral-50` → `oklch(0.985 0 0)`  |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `muted`                  | `--muted`                  | `--palette-neutral-100` → `oklch(0.97 0 0)`  | `--palette-neutral-800` → `oklch(0.269 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `muted-foreground`       | `--muted-foreground`       | `oklch(0.542 0 0)`                           | `--palette-neutral-400` → `oklch(0.708 0 0)` | 명도(L)만 0.556에서 0.542로 낮췄다(색상·채도는 그대로). 원래 값은 muted 배경(#f5f5f5) 위에서 4.34:1로 WCAG AA(4.5:1)에 못 미쳤다(2026-09-16 Storybook a11y 게이트가 kbd, FilterChip, BackToTopButton 등에서 실측). OKLCH를 sRGB로 바꾼 뒤 WCAG 상대 휘도 공식으로 계산해 4.60:1이 되는 최소 조정값을 찾았다(#737373에서 #6f6f6f, Artifact 미리보기로 사용자 승인). 팔레트(neutral.500 = 0.556) 밖의 값이라 별칭이 아니라 숫자로 둔다. |
| `accent`                 | `--accent`                 | `--palette-neutral-100` → `oklch(0.97 0 0)`  | `--palette-neutral-800` → `oklch(0.269 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `accent-foreground`      | `--accent-foreground`      | `--palette-neutral-900` → `oklch(0.205 0 0)` | `--palette-neutral-50` → `oklch(0.985 0 0)`  |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `destructive`            | `--destructive`            | `oklch(0.577 0.245 27.325)`                  | `oklch(0.704 0.191 22.216)`                  |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `destructive-foreground` | `--destructive-foreground` | `--palette-white` → `oklch(1 0 0)`           | 라이트와 같음                                |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `scrim`                  | `--scrim`                  | `--palette-black` → `oklch(0 0 0)`           | 라이트와 같음                                | 딤(scrim) 오버레이 전용. 모드와 무관해 다크에서 다시 정하지 않는다. 쓰는 곳은 투명도 수식자를 붙여 쓴다(docs/DECISIONS.md 2026-09-13).                                                                                                                                                                                                                                                                                                |
| `scrim-foreground`       | `--scrim-foreground`       | `--palette-white` → `oklch(1 0 0)`           | 라이트와 같음                                | 딤 위의 글자색. destructive-foreground와 값은 같은 흰색이지만 역할이 다른(딤 위 글자, 버튼 위 글자) 별도 토큰이다.                                                                                                                                                                                                                                                                                                                    |
| `info`                   | `--info`                   | `oklch(0.575 0.233 262)`                     | `oklch(0.707 0.165 254)`                     | 명도(L)를 낮춰 WCAG AA(4.5:1)를 4.60:1로 넘긴다(2026-09-16 a11y 게이트 실측. 다크는 7:1 이상이라 그대로 뒀다). 원래 값에서 1~2%p만 낮춰 눈으로는 거의 같다. Artifact 미리보기로 사용자 승인.                                                                                                                                                                                                                                          |
| `info-foreground`        | `--info-foreground`        | `--palette-white` → `oklch(1 0 0)`           | `--palette-white` → `oklch(1 0 0)`           |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `warning`                | `--warning`                | `oklch(0.769 0.188 85)`                      | `oklch(0.769 0.188 85)`                      |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `warning-foreground`     | `--warning-foreground`     | `--palette-neutral-950` → `oklch(0.145 0 0)` | `--palette-neutral-950` → `oklch(0.145 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `success`                | `--success`                | `oklch(0.543 0.194 142)`                     | `oklch(0.749 0.155 152)`                     | info와 같은 이유로 명도(L)를 낮췄다. 원래 3.29:1로 가장 크게 못 미쳐 눈에 띄게 진해졌다(#2ba321에서 #008900). Artifact 미리보기로 사용자 승인(2026-09-16).                                                                                                                                                                                                                                                                            |
| `success-foreground`     | `--success-foreground`     | `--palette-white` → `oklch(1 0 0)`           | `--palette-white` → `oklch(1 0 0)`           |                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `border`                 | `--border`                 | `--palette-neutral-200` → `oklch(0.922 0 0)` | `oklch(1 0 0 / 10%)`                         | 다크: 흰색에 투명도를 얹은 값이다. 별칭 뒤에는 알파를 붙일 수 없어 팔레트를 가리키지 않고 숫자로 둔다.                                                                                                                                                                                                                                                                                                                                |
| `input`                  | `--input`                  | `--palette-neutral-200` → `oklch(0.922 0 0)` | `oklch(1 0 0 / 15%)`                         | 다크: border(다크)와 같은 이유로 숫자로 둔다.                                                                                                                                                                                                                                                                                                                                                                                         |
| `ring`                   | `--ring`                   | `--palette-neutral-400` → `oklch(0.708 0 0)` | `--palette-neutral-500` → `oklch(0.556 0 0)` |                                                                                                                                                                                                                                                                                                                                                                                                                                       |

## 반경

모서리 반경 4단계. 부품은 rounded-<이름> 클래스로 쓴다. 원래는 기준 값 하나(--radius, 0.625rem)에서 calc()로 계산했다(sm = 기준 - 4px 등). DTCG 형식은 계산식을 적을 수 없어 브라우저 기본 글자 크기(16px)에서의 계산값을 고정 값으로 옮겼다(2026-11-24 사용자 결정). 기본 글자 크기를 바꾼 브라우저에서는 sm·md·xl이 예전과 조금 다르다(20px일 때 sm 8.5px에서 7.5px, md 10.5px에서 10px, xl 16.5px에서 17.5px). 기준 값 변수(--radius)는 없앴다.

원본: [`radius.tokens.json`](../packages/ui/tokens/radius.tokens.json)

| 클래스       | CSS 변수      | 값                | 설명 |
| ------------ | ------------- | ----------------- | ---- |
| `rounded-sm` | `--radius-sm` | `0.375rem` (6px)  |      |
| `rounded-md` | `--radius-md` | `0.5rem` (8px)    |      |
| `rounded-lg` | `--radius-lg` | `0.625rem` (10px) |      |
| `rounded-xl` | `--radius-xl` | `0.875rem` (14px) |      |

## 겹침 순서

겹침 순서 8단계. 부품은 숫자 대신 이름 붙은 클래스로 쓴다(숫자를 직접 쓰면 린트가 막는다). 값은 2026-09-13에 흩어져 있던 숫자 8종을 그대로 모은 것이다. scrim은 Sidebar 백드롭과 CommentComposer 펼친 시트가 함께 쓴다. 둘 다 모바일 전용 fixed 요소라 동시에 뜨면 DOM 순서로 위아래가 정해지는 잠재 충돌이 있다(docs/DECISIONS.md 2026-09-13).

원본: [`z-index.tokens.json`](../packages/ui/tokens/z-index.tokens.json)

| 클래스      | CSS 변수            | 값   | 설명                                                      |
| ----------- | ------------------- | ---- | --------------------------------------------------------- |
| `z-raised`  | `--z-index-raised`  | `10` | 카드/폼 내부 오버레이                                     |
| `z-hitbox`  | `--z-index-hitbox`  | `20` | 댓글 첨부 드롭 히트박스                                   |
| `z-panel`   | `--z-index-panel`   | `40` | RecentSearchPanel · CommentComposer 접힌 바               |
| `z-nav`     | `--z-index-nav`     | `50` | Navbar / BottomTabBar / FAB                               |
| `z-scrim`   | `--z-index-scrim`   | `55` | Sidebar 백드롭 · CommentComposer 펼친 시트 (같은 층 공유) |
| `z-drawer`  | `--z-index-drawer`  | `60` | Sidebar 패널                                              |
| `z-modal`   | `--z-index-modal`   | `70` | Dialog                                                    |
| `z-popover` | `--z-index-popover` | `80` | Dropdown / Select / Tooltip                               |

## 글자 크기 눈금

글자 크기 눈금 14단계(t1~t14). 당근 SEED 디자인 시스템의 글자 크기 값을 그대로 가져왔다(https://seed-design.io/foundations/typography 의 $font-size.t1~t14). Tailwind 기본 글자 크기 클래스는 그대로 두고, 이 눈금은 주로 역할 토큰(text)의 재료로 쓴다. 부품이 직접 쓰는 것은 역할 토큰에 묶지 않은 반응형 제목의 데스크톱 크기뿐이다. 글자 두께는 토큰을 두지 않는다(SEED의 medium 500, bold 700이 Tailwind 기본 클래스와 값이 같다). 줄 높이는 line-height의 같은 이름 토큰이 짝이다.

글자 크기 눈금(font-size)의 짝이 되는 줄 높이 14단계. 값 출처는 font-size와 같다(SEED의 $line-height.t1~t14). 같은 이름의 글자 크기 클래스를 쓰면 함께 적용된다.

원본: [`font-size.tokens.json`](../packages/ui/tokens/font-size.tokens.json), [`line-height.tokens.json`](../packages/ui/tokens/line-height.tokens.json)

| 클래스     | 글자 크기          | 줄 높이            | 설명                                      |
| ---------- | ------------------ | ------------------ | ----------------------------------------- |
| `text-t1`  | `0.6875rem` (11px) | `0.9375rem` (15px) |                                           |
| `text-t2`  | `0.75rem` (12px)   | `1rem` (16px)      |                                           |
| `text-t3`  | `0.8125rem` (13px) | `1.125rem` (18px)  |                                           |
| `text-t4`  | `0.875rem` (14px)  | `1.1875rem` (19px) |                                           |
| `text-t5`  | `1rem` (16px)      | `1.375rem` (22px)  |                                           |
| `text-t6`  | `1.125rem` (18px)  | `1.5rem` (24px)    |                                           |
| `text-t7`  | `1.25rem` (20px)   | `1.6875rem` (27px) |                                           |
| `text-t8`  | `1.375rem` (22px)  | `1.875rem` (30px)  |                                           |
| `text-t9`  | `1.5rem` (24px)    | `2rem` (32px)      |                                           |
| `text-t10` | `1.625rem` (26px)  | `2.1875rem` (35px) |                                           |
| `text-t11` | `1.75rem` (28px)   | `2.375rem` (38px)  | sm 이상 화면에서만 쓰기를 권장(SEED 문서) |
| `text-t12` | `2rem` (32px)      | `2.625rem` (42px)  | sm 이상 화면에서만 쓰기를 권장(SEED 문서) |
| `text-t13` | `2.5rem` (40px)    | `3.25rem` (52px)   | sm 이상 화면에서만 쓰기를 권장(SEED 문서) |
| `text-t14` | `3rem` (48px)      | `3.75rem` (60px)   | sm 이상 화면에서만 쓰기를 권장(SEED 문서) |

## 글자 역할

글자 역할 토큰 8종. 눈금(font-size, line-height)에서 실제 화면에 쓰는 값만 골라 이름을 붙였다. 클래스 하나가 글자 크기, 줄 높이, 두께(있는 경우)를 함께 정한다. 제목류는 두께까지 묶어 따로 두께 클래스를 겹쳐 쓰지 않게 했다(screen-title은 2026-09-16에 semibold로 통일). micro는 쓰는 곳마다 두께가 달라 묶지 않는다. card-title과 detail-title은 반응형이라 데스크톱 크기를 역할에 묶지 않고 쓰는 곳에서 눈금 클래스로 올린다. group-label과 display-title은 원래 쓰던 Tailwind 기본 클래스 조합과 계산값이 같다. 처음 4개와 뒤에 더한 것들의 승인 경위는 docs/plans/2026-09-16-typography-tokens-a11y-gate.md에 있다.

원본: [`text.tokens.json`](../packages/ui/tokens/text.tokens.json)

| 클래스                  | 글자 크기          | 줄 높이            | 두께      | 설명                                                   |
| ----------------------- | ------------------ | ------------------ | --------- | ------------------------------------------------------ |
| `text-screen-title`     | `1.25rem` (20px)   | `1.6875rem` (27px) | `600`     | 페이지 최상위 제목 (h1)                                |
| `text-section-title`    | `1.125rem` (18px)  | `1.5rem` (24px)    | `600`     | 섹션 제목 (h2), Dialog 제목                            |
| `text-subsection-title` | `0.875rem` (14px)  | `1.1875rem` (19px) | `600`     | 소제목, 보통 text-muted-foreground와 함께              |
| `text-micro`            | `0.6875rem` (11px) | `0.9375rem` (15px) | 묶지 않음 | 배지·단축키·카운트 같은 최소 라벨 (두께는 토큰에 없음) |
| `text-card-title`       | `0.875rem` (14px)  | `1.1875rem` (19px) | `700`     | 포스트 카드 제목 (md:text-t6과 조합해 반응형)          |
| `text-detail-title`     | `1.5rem` (24px)    | `2rem` (32px)      | `700`     | 상세 페이지 게시글 제목 (md:text-t11과 조합해 반응형)  |
| `text-group-label`      | `0.75rem` (12px)   | `1rem` (16px)      | `600`     | 목록 섹션 라벨 (폴더 그룹, 최근 검색 등)               |
| `text-display-title`    | `3.75rem` (60px)   | `3.75rem` (60px)   | `700`     | 대형 에러 페이지 타이틀 (404/403/500)                  |
