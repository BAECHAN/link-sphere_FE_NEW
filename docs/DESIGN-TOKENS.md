# 디자인 토큰 표

> `pnpm tokens`가 [`packages/ui/tokens/`](../packages/ui/tokens/)의 원본에서 만든 파일이다. 직접 고치지 않는다.

공용 UI 패키지(`@baechan/ui`)의 범용 토큰 123개와 값을 정한 이유다.
앱 전용 토큰(카테고리·차트·사이드바 등)은 [`src/app/globals.css`](../src/app/globals.css)에 있고 이 표에 없다.
원본과 생성물이 어떻게 이어지는지, 값을 고치는 순서는
[`DESIGN-SYSTEM.md`](./DESIGN-SYSTEM.md) §5 "토큰 원본과 생성물"에 있다.
rem 옆의 px는 브라우저 기본 글자 크기(16px)일 때의 값이다.

## 팔레트

팔레트(원시 층). 의미 색(color)은 값을 숫자로 적지 않고 모두 이 토큰을 가리킨다(생성 스크립트가 숫자 값을 막는다). 색 이름은 당근 SEED·토스 TDS와 같은 단어(gray, red, blue, yellow, green)이고, 번호는 같은 색상의 Tailwind 기본 팔레트에서 명도(L)가 가장 가까운 단계다. 값이 Tailwind와 같은 것은 따로 적었다. Tailwind 값을 참조하지 않고 직접 정의해 Tailwind 버전이 바뀌어도 테마가 따라 바뀌지 않는다. 실제로 가리키는 단계만 둔다. 모드와 무관해 다크에서 다시 정하지 않는다(모드마다 다른 팔레트를 가리키는 것은 의미 색이다). Tailwind 테마 키로 내보내지 않아 팔레트 이름의 유틸리티 클래스는 생기지 않는다(부품은 의미 색만 쓴다). 2026-11-26 게이트 2에서 정했다(docs/DESIGN-SYSTEM.md §5).

원본: [`palette.tokens.json`](../packages/ui/tokens/palette.tokens.json)

| 이름             | CSS 변수                   | 값                          | 설명                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------- | -------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `white`          | `--palette-white`          | `oklch(1 0 0)`              |                                                                                                                                                                                                                                                                                                                                                                                       |
| `gray-50`        | `--palette-gray-50`        | `oklch(0.985 0 0)`          |                                                                                                                                                                                                                                                                                                                                                                                       |
| `gray-100`       | `--palette-gray-100`       | `oklch(0.97 0 0)`           |                                                                                                                                                                                                                                                                                                                                                                                       |
| `gray-200`       | `--palette-gray-200`       | `oklch(0.922 0 0)`          |                                                                                                                                                                                                                                                                                                                                                                                       |
| `gray-400`       | `--palette-gray-400`       | `oklch(0.708 0 0)`          |                                                                                                                                                                                                                                                                                                                                                                                       |
| `gray-500`       | `--palette-gray-500`       | `oklch(0.556 0 0)`          |                                                                                                                                                                                                                                                                                                                                                                                       |
| `gray-550`       | `--palette-gray-550`       | `oklch(0.542 0 0)`          | Tailwind에 없는 단계(500과 600 사이). 500(0.556)에서 명도(L)만 0.542로 낮췄다. 500은 muted 배경(#f5f5f5) 위에서 4.34:1로 WCAG AA(4.5:1)에 못 미쳤다(2026-09-16 Storybook a11y 게이트가 kbd, FilterChip, BackToTopButton 등에서 실측). OKLCH를 sRGB로 바꾼 뒤 WCAG 상대 휘도 공식으로 계산해 4.60:1이 되는 최소 조정값을 찾았다(#737373에서 #6f6f6f, Artifact 미리보기로 사용자 승인). |
| `gray-800`       | `--palette-gray-800`       | `oklch(0.269 0 0)`          |                                                                                                                                                                                                                                                                                                                                                                                       |
| `gray-900`       | `--palette-gray-900`       | `oklch(0.205 0 0)`          |                                                                                                                                                                                                                                                                                                                                                                                       |
| `gray-950`       | `--palette-gray-950`       | `oklch(0.145 0 0)`          |                                                                                                                                                                                                                                                                                                                                                                                       |
| `black`          | `--palette-black`          | `oklch(0 0 0)`              |                                                                                                                                                                                                                                                                                                                                                                                       |
| `white-alpha-10` | `--palette-white-alpha-10` | `oklch(1 0 0 / 10%)`        | 흰색에 투명도 10%를 얹은 색. 번호는 투명도 %다(당근 SEED의 static-white-alpha-*, 토스 TDS의 greyOpacity*는 번호가 투명도가 아니라 단계다. 우리는 투명도 값이 둘뿐이라 단계표를 따로 만들지 않았다). 별칭 뒤에는 투명도를 붙일 수 없어 투명도마다 토큰을 둔다.                                                                                                                         |
| `white-alpha-15` | `--palette-white-alpha-15` | `oklch(1 0 0 / 15%)`        | 흰색에 투명도 15%를 얹은 색. 번호를 정한 방법은 white-alpha.10과 같다.                                                                                                                                                                                                                                                                                                                |
| `red-400`        | `--palette-red-400`        | `oklch(0.704 0.191 22.216)` | Tailwind red-400과 같은 값.                                                                                                                                                                                                                                                                                                                                                           |
| `red-600`        | `--palette-red-600`        | `oklch(0.577 0.245 27.325)` | Tailwind red-600과 같은 값.                                                                                                                                                                                                                                                                                                                                                           |
| `blue-400`       | `--palette-blue-400`       | `oklch(0.707 0.165 254)`    | Tailwind blue-400(0.707 0.165 254.624)에서 색상각(H)만 254로 적은 값.                                                                                                                                                                                                                                                                                                                 |
| `blue-600`       | `--palette-blue-600`       | `oklch(0.575 0.233 262)`    | Tailwind blue-600(0.546)과 다른 값. 2026-09-16 a11y 게이트 실측에서 원래 값(L 0.585)이 WCAG AA(4.5:1)에 못 미쳐, 명도(L)만 0.575로 낮춰 4.60:1로 넘겼다(다크에서 가리키는 blue.400은 7:1 이상이라 그대로 뒀다). 1%p만 낮춰 눈으로는 거의 같다. Artifact 미리보기로 사용자 승인.                                                                                                       |
| `yellow-500`     | `--palette-yellow-500`     | `oklch(0.769 0.188 85)`     | Tailwind yellow-500(0.795 0.184 86.047)과 다른 값.                                                                                                                                                                                                                                                                                                                                    |
| `green-500`      | `--palette-green-500`      | `oklch(0.749 0.155 152)`    | Tailwind green-500(0.723 0.219 149.579)과 다른 값.                                                                                                                                                                                                                                                                                                                                    |
| `green-700`      | `--palette-green-700`      | `oklch(0.543 0.194 142)`    | Tailwind green-700(0.527 0.154 150.069)과 다른 값. blue.600과 같은 이유로 원래 값(L 0.627)의 명도(L)를 0.543으로 낮췄다. 원래 3.29:1로 가장 크게 못 미쳐 눈에 띄게 진해졌다(#2ba321에서 #008900). Artifact 미리보기로 사용자 승인(2026-09-16).                                                                                                                                        |

## 의미 색

의미 색(라이트). shadcn/ui 이름을 쓴다. Tailwind 색 이름으로 내보내 bg-primary, text-muted-foreground 같은 클래스가 된다. 값은 모두 팔레트(palette)를 가리키는 별칭이다. 다크에서 달라지는 값은 color.dark.tokens.json에 있다.

원본: [`color.tokens.json`](../packages/ui/tokens/color.tokens.json), [`color.dark.tokens.json`](../packages/ui/tokens/color.dark.tokens.json)

| 이름                     | CSS 변수                   | 라이트                                            | 다크                                              | 설명                                                                                                                                   |
| ------------------------ | -------------------------- | ------------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `background`             | `--background`             | `--palette-white` → `oklch(1 0 0)`                | `--palette-gray-950` → `oklch(0.145 0 0)`         |                                                                                                                                        |
| `foreground`             | `--foreground`             | `--palette-gray-950` → `oklch(0.145 0 0)`         | `--palette-gray-50` → `oklch(0.985 0 0)`          |                                                                                                                                        |
| `card`                   | `--card`                   | `--palette-white` → `oklch(1 0 0)`                | `--palette-gray-900` → `oklch(0.205 0 0)`         |                                                                                                                                        |
| `card-foreground`        | `--card-foreground`        | `--palette-gray-950` → `oklch(0.145 0 0)`         | `--palette-gray-50` → `oklch(0.985 0 0)`          |                                                                                                                                        |
| `popover`                | `--popover`                | `--palette-white` → `oklch(1 0 0)`                | `--palette-gray-900` → `oklch(0.205 0 0)`         |                                                                                                                                        |
| `popover-foreground`     | `--popover-foreground`     | `--palette-gray-950` → `oklch(0.145 0 0)`         | `--palette-gray-50` → `oklch(0.985 0 0)`          |                                                                                                                                        |
| `primary`                | `--primary`                | `--palette-gray-900` → `oklch(0.205 0 0)`         | `--palette-gray-200` → `oklch(0.922 0 0)`         |                                                                                                                                        |
| `primary-foreground`     | `--primary-foreground`     | `--palette-gray-50` → `oklch(0.985 0 0)`          | `--palette-gray-900` → `oklch(0.205 0 0)`         |                                                                                                                                        |
| `secondary`              | `--secondary`              | `--palette-gray-100` → `oklch(0.97 0 0)`          | `--palette-gray-800` → `oklch(0.269 0 0)`         |                                                                                                                                        |
| `secondary-foreground`   | `--secondary-foreground`   | `--palette-gray-900` → `oklch(0.205 0 0)`         | `--palette-gray-50` → `oklch(0.985 0 0)`          |                                                                                                                                        |
| `muted`                  | `--muted`                  | `--palette-gray-100` → `oklch(0.97 0 0)`          | `--palette-gray-800` → `oklch(0.269 0 0)`         |                                                                                                                                        |
| `muted-foreground`       | `--muted-foreground`       | `--palette-gray-550` → `oklch(0.542 0 0)`         | `--palette-gray-400` → `oklch(0.708 0 0)`         | muted 배경 위에서 WCAG AA(4.5:1)를 넘기려고 gray.500 대신 gray.550을 가리킨다. 값을 정한 근거는 palette.gray.550의 설명에 있다.        |
| `accent`                 | `--accent`                 | `--palette-gray-100` → `oklch(0.97 0 0)`          | `--palette-gray-800` → `oklch(0.269 0 0)`         |                                                                                                                                        |
| `accent-foreground`      | `--accent-foreground`      | `--palette-gray-900` → `oklch(0.205 0 0)`         | `--palette-gray-50` → `oklch(0.985 0 0)`          |                                                                                                                                        |
| `destructive`            | `--destructive`            | `--palette-red-600` → `oklch(0.577 0.245 27.325)` | `--palette-red-400` → `oklch(0.704 0.191 22.216)` |                                                                                                                                        |
| `destructive-foreground` | `--destructive-foreground` | `--palette-white` → `oklch(1 0 0)`                | 라이트와 같음                                     |                                                                                                                                        |
| `scrim`                  | `--scrim`                  | `--palette-black` → `oklch(0 0 0)`                | 라이트와 같음                                     | 딤(scrim) 오버레이 전용. 모드와 무관해 다크에서 다시 정하지 않는다. 쓰는 곳은 투명도 수식자를 붙여 쓴다(docs/DECISIONS.md 2026-09-13). |
| `scrim-foreground`       | `--scrim-foreground`       | `--palette-white` → `oklch(1 0 0)`                | 라이트와 같음                                     | 딤 위의 글자색. destructive-foreground와 값은 같은 흰색이지만 역할이 다른(딤 위 글자, 버튼 위 글자) 별도 토큰이다.                     |
| `info`                   | `--info`                   | `--palette-blue-600` → `oklch(0.575 0.233 262)`   | `--palette-blue-400` → `oklch(0.707 0.165 254)`   |                                                                                                                                        |
| `info-foreground`        | `--info-foreground`        | `--palette-white` → `oklch(1 0 0)`                | `--palette-white` → `oklch(1 0 0)`                |                                                                                                                                        |
| `warning`                | `--warning`                | `--palette-yellow-500` → `oklch(0.769 0.188 85)`  | `--palette-yellow-500` → `oklch(0.769 0.188 85)`  |                                                                                                                                        |
| `warning-foreground`     | `--warning-foreground`     | `--palette-gray-950` → `oklch(0.145 0 0)`         | `--palette-gray-950` → `oklch(0.145 0 0)`         |                                                                                                                                        |
| `success`                | `--success`                | `--palette-green-700` → `oklch(0.543 0.194 142)`  | `--palette-green-500` → `oklch(0.749 0.155 152)`  |                                                                                                                                        |
| `success-foreground`     | `--success-foreground`     | `--palette-white` → `oklch(1 0 0)`                | `--palette-white` → `oklch(1 0 0)`                |                                                                                                                                        |
| `border`                 | `--border`                 | `--palette-gray-200` → `oklch(0.922 0 0)`         | `--palette-white-alpha-10` → `oklch(1 0 0 / 10%)` |                                                                                                                                        |
| `input`                  | `--input`                  | `--palette-gray-200` → `oklch(0.922 0 0)`         | `--palette-white-alpha-15` → `oklch(1 0 0 / 15%)` |                                                                                                                                        |
| `ring`                   | `--ring`                   | `--palette-gray-400` → `oklch(0.708 0 0)`         | `--palette-gray-500` → `oklch(0.556 0 0)`         |                                                                                                                                        |

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

## 시간

전환·애니메이션 시간. 부품은 숫자 대신 duration-<이름> 클래스로 쓴다(숫자나 대괄호 값을 쓰면 린트가 막는다). 눈금 이름은 당근(SEED)처럼 50ms를 한 단계로 센 번호이고(d3 = 150ms), 지금 화면에서 쓰는 단계만 둔다(2026-11-26 게이트 2). 시간 클래스 없이 transition만 붙인 곳은 Tailwind 기본 시간이 color-transition을 가리켜 같은 값을 쓴다. tw-animate-css의 animate-in·animate-out은 시간 클래스가 없으면 이 토큰이 아니라 자기 기본값(150ms)을 쓴다. CSS 전환이 끝나기를 기다리는 JS 타이머는 숫자를 따로 적지 않고 생성된 DURATION_MS를 읽는다.

원본: [`duration.tokens.json`](../packages/ui/tokens/duration.tokens.json)

| 클래스                      | CSS 변수                                 | 값                                   | 설명                                                                                                                                                                                                                                                                   |
| --------------------------- | ---------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `duration-d3`               | `--transition-duration-d3`               | `150ms`                              | 첨부 이미지 미리보기의 삭제 버튼                                                                                                                                                                                                                                       |
| `duration-d4`               | `--transition-duration-d4`               | `200ms`                              | 대화상자·확인 창과 그 딤의 열림·닫힘, 선택 상자 화살표, 맨 위로 버튼, 지연 표시와 뼈대가 나타날 때, 좁은 화면 메뉴, 댓글 강조가 나타날 때                                                                                                                              |
| `duration-d6`               | `--transition-duration-d6`               | `300ms`                              | 아래에서 올라오는 시트와 그 딤, 댓글 입력칸의 끌어 놓기 테두리, 카드 썸네일 확대. 알림 창을 닫은 뒤 목록에서 지우는 JS 타이머와 이미지 뷰어를 닫은 뒤 커서를 고치는 JS 타이머도 이 값을 읽는다(둘 다 닫힘 애니메이션 d4보다 길게 기다린다. 왜 이 값인지는 기록에 없다) |
| `duration-d12`              | `--transition-duration-d12`              | `600ms`                              | 댓글로 이동했을 때 강조가 흐려지는 시간. 강조를 떼는 JS 타이머도 이 값을 읽는다                                                                                                                                                                                        |
| `duration-color-transition` | `--transition-duration-color-transition` | `--transition-duration-d3` → `150ms` | 색·배경·투명도처럼 모양이 그대로인 짧은 전환. Tailwind 기본 시간(transition만 붙인 곳)이 이 토큰을 가리킨다. 당근의 같은 이름 역할과 같은 단계다                                                                                                                       |

## 가속 곡선

가속 곡선. 부품은 ease-<이름> 클래스로 쓴다(Tailwind 기본 이름 ease-in·ease-out·ease-in-out·ease-linear과 대괄호 값은 린트가 막는다). 이름은 당근(SEED)의 easing·enter를 따랐고 값은 지금 화면 값 그대로라 당근 값과 다르다(당근 easing은 0.35, 0, 0.35, 1). 곡선 클래스 없이 transition만 붙인 곳은 Tailwind 기본 곡선이 easing을 가리켜 같은 값을 쓴다. tw-animate-css의 animate-in·animate-out은 곡선 클래스가 없으면 이 토큰이 아니라 CSS 기본 ease를 쓴다.

원본: [`timing-function.tokens.json`](../packages/ui/tokens/timing-function.tokens.json)

| 클래스        | CSS 변수        | 값                               | 설명                                                                                                                   |
| ------------- | --------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `ease-easing` | `--ease-easing` | `cubic-bezier(0.4, 0, 0.2, 1)`   | 천천히 시작해 천천히 멈춘다. Tailwind 기본 곡선이 이 토큰을 가리킨다(Tailwind ease-in-out과 같은 값). 선택 상자 화살표 |
| `ease-enter`  | `--ease-enter`  | `cubic-bezier(0, 0, 0.2, 1)`     | 빠르게 시작해 천천히 멈춘다(Tailwind ease-out과 같은 값). 뼈대가 나타날 때, 댓글 강조                                  |
| `ease-sheet`  | `--ease-sheet`  | `cubic-bezier(0.32, 0.72, 0, 1)` | 아래에서 올라오는 시트와 그 딤. vaul이 드로어와 딤에 함께 쓰는 값이다(고른 근거: docs/DECISIONS.md 2026-11-03)         |

## 그림자

그림자 4단계. 부품은 shadow-<이름> 클래스로 쓴다(Tailwind 기본 이름이나 대괄호 값을 쓰면 린트가 막는다. 그림자를 없애는 shadow-none은 그대로 쓴다). 이름은 당근(SEED)처럼 깊이 순서 번호이고(s1이 가장 얕다), 값은 지금 화면에서 쓰던 Tailwind 기본 그림자 네 단계(xs, sm, md, lg)를 그대로 옮겼다(2026-11-26 게이트 2). 한 그림자가 층 여러 개로 이루어질 수 있다. 색은 팔레트를 가리키지 않고 검정에 투명도를 붙여 숫자로 적는다(당근도 그림자 색을 값으로 적는다). 다크 모드 값은 따로 두지 않는다.

원본: [`shadow.tokens.json`](../packages/ui/tokens/shadow.tokens.json)

| 클래스      | CSS 변수      | 값                                                                           | 설명                                                                                                                                                                               |
| ----------- | ------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shadow-s1` | `--shadow-s1` | `0px 1px 2px 0px oklch(0 0 0 / 5%)`                                          | 바탕에 붙은 조작 부품: 입력칸, 여러 줄 입력칸, 선택 상자 버튼, 체크박스, 스위치, 외곽선 버튼                                                                                       |
| `shadow-s2` | `--shadow-s2` | `0px 1px 3px 0px oklch(0 0 0 / 10%), 0px 1px 2px -1px oklch(0 0 0 / 10%)`    | 바탕에서 조금 뜬 면: 카드, 선택된 필터 칩, 게시글의 링크 미리보기, 첨부 이미지 미리보기의 삭제 버튼, 목록을 다시 불러올 때의 안내                                                  |
| `shadow-s3` | `--shadow-s3` | `0px 4px 6px -1px oklch(0 0 0 / 10%), 0px 2px 4px -2px oklch(0 0 0 / 10%)`   | 펼친 목록(드롭다운 하위 메뉴, 선택 상자 목록, 최근 검색어)과 마우스를 올린 카드(검색 필터, 내 댓글, 링크 미리보기)                                                                 |
| `shadow-s4` | `--shadow-s4` | `0px 10px 15px -3px oklch(0 0 0 / 10%), 0px 4px 6px -4px oklch(0 0 0 / 10%)` | 화면 위에 떠 있는 것: 대화상자, 확인 창, 드롭다운 메뉴, 알림, 맨 위로 버튼, 모바일 댓글 입력, 인증 화면의 카드, 스위치 손잡이. 피드 카드에 마우스를 올리거나 카드 메뉴를 열었을 때 |

## 역할 간격

역할 간격. 숫자로 고르는 간격은 Tailwind 눈금(--spacing의 배수)을 그대로 쓰고, 같은 뜻으로 여러 곳에 되풀이되는 간격에만 이름을 붙인다(2026-11-26 게이트 2). 이름은 당근(SEED)의 역할 간격(dimension.yaml의 spacing-x, spacing-y 묶음)에서 따 왔다. 부품은 gap 클래스 뒤에 이름을 붙여 쓴다.

원본: [`spacing.tokens.json`](../packages/ui/tokens/spacing.tokens.json)

| 클래스              | CSS 변수                  | 값             | 설명                                                                                                                                                                                                                                                                                                                                                                           |
| ------------------- | ------------------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `gap-between-chips` | `--spacing-between-chips` | `0.5rem` (8px) | 칩 사이 간격. 칩이 줄을 바꿔 쌓일 때 위아래 간격도 같다. 쓰는 곳: 피드 카드의 카테고리 칩 줄과 태그 줄, 그 카드를 불러오는 동안 보이는 골격의 칩 자리, 피드 위 필터의 카테고리 칩 줄과 범위 칩 줄. 값은 옮기기 전에 쓰던 숫자 간격(눈금 2칸, 0.5rem)과 같다. 당근은 가로 간격(spacing-x)으로만 8px을 두지만 우리 칩 줄은 줄바꿈이 있어 가로세로를 함께 쓰고 이름에서 x를 뺐다. |
