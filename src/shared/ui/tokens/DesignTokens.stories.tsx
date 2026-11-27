import { useState, type CSSProperties } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from '@/shared/ui/atoms/badge';
import { Button } from '@baechan/ui/atoms/button';
import { cn } from '@baechan/ui/lib/tailwind/utils';
import { TOKENS } from '@baechan/ui/tokens';

// 이 파일은 단일 컴포넌트가 아니라 디자인 토큰(범용 토큰은 공용 UI 패키지의 packages/ui/tokens/ 원본,
// 앱 전용 토큰은 src/app/globals.css)을 한눈에 보여주는 카탈로그다. 값을 복제하지 않고 CSS 커스텀 프로퍼티 원본 이름(var(--primary) 등, `var(--${token})`)을
// 인라인 style로 직접 읽어 렌더링한다 - 토큰이 바뀌면 이 스토리도 자동으로 따라간다.
// (Tailwind의 `bg-${token}`처럼 클래스명을 동적으로 조합하면 JIT 스캐너가 정적 문자열만
// 인식하기 때문에 생성되지 않는다 - 그래서 여기서는 클래스가 아니라 CSS 변수를 직접 쓴다.)
// 범용 토큰의 이름과 쓰임 설명은 원본에서 만든 목록(TOKENS)에서 읽는다. 앱 전용 토큰은 원본이 없어 아래에 손으로 적는다.
// 의미 색(fg·bg·stroke, 2026-11-27 게이트 3)은 변수 이름이 이름과 달라(--bui-color-fg-neutral) 목록의 cssVar를 읽는다.
// 다크모드는 툴바의 테마 토글(.storybook/preview.tsx)로 확인한다.

type DesignToken = (typeof TOKENS)[number];
type ShadcnColorName = Extract<DesignToken, { group: 'shadcn' }>['name'];

interface ColorToken<Name extends string = string> {
  /** Tailwind 색상 유틸리티 접미사 (bg-{token}) */
  token: Name;
  /** 짝을 이루는 foreground 토큰이 있으면 그 위에 샘플 텍스트를 얹는다 */
  foreground?: Name;
}

interface ColorGroup {
  title: string;
  tokens: ColorToken[];
}

/** 옛 shadcn 이름 묶음. 묶음 제목은 원본에 없어 여기서 정하고, 색 이름이 원본에 없으면 타입 오류가 난다. */
function shadcnColors(title: string, tokens: ColorToken<ShadcnColorName>[]): ColorGroup {
  return { title: `${title} (옛 shadcn 이름)`, tokens };
}

// 옛 이름은 shadcnColors로, 앱 전용 색(src/app/globals.css의 @theme inline 블록)은 그대로 적는다.
const COLOR_GROUPS: ColorGroup[] = [
  shadcnColors('기본', [{ token: 'background', foreground: 'foreground' }]),
  shadcnColors('딤(Scrim) — 이미지 뷰어·모달 오버레이 전용, 테마 무관', [
    { token: 'scrim', foreground: 'scrim-foreground' },
  ]),
  shadcnColors('표면', [
    { token: 'card', foreground: 'card-foreground' },
    { token: 'popover', foreground: 'popover-foreground' },
  ]),
  shadcnColors('액션', [
    { token: 'primary', foreground: 'primary-foreground' },
    { token: 'secondary', foreground: 'secondary-foreground' },
    { token: 'muted', foreground: 'muted-foreground' },
    { token: 'accent', foreground: 'accent-foreground' },
  ]),
  shadcnColors('상태', [
    { token: 'destructive', foreground: 'destructive-foreground' },
    { token: 'info', foreground: 'info-foreground' },
    { token: 'warning', foreground: 'warning-foreground' },
    { token: 'success', foreground: 'success-foreground' },
  ]),
  {
    title: '도메인 (link-sphere 고유 — 다른 프로젝트로 이식 시 재검토 대상)',
    tokens: [
      { token: 'category', foreground: 'category-foreground' },
      { token: 'category-1', foreground: 'category-1-foreground' },
      { token: 'category-2', foreground: 'category-2-foreground' },
      { token: 'category-3', foreground: 'category-3-foreground' },
      { token: 'category-4', foreground: 'category-4-foreground' },
      { token: 'category-5', foreground: 'category-5-foreground' },
      { token: 'category-6', foreground: 'category-6-foreground' },
      { token: 'category-7', foreground: 'category-7-foreground' },
      { token: 'category-8', foreground: 'category-8-foreground' },
    ],
  },
  shadcnColors('폼 / 포커스', [{ token: 'border' }, { token: 'input' }, { token: 'ring' }]),
  {
    title: '차트',
    tokens: [
      { token: 'chart-1' },
      { token: 'chart-2' },
      { token: 'chart-3' },
      { token: 'chart-4' },
      { token: 'chart-5' },
    ],
  },
  {
    title: '사이드바',
    tokens: [
      { token: 'sidebar', foreground: 'sidebar-foreground' },
      { token: 'sidebar-primary', foreground: 'sidebar-primary-foreground' },
      { token: 'sidebar-accent', foreground: 'sidebar-accent-foreground' },
      { token: 'sidebar-border' },
      { token: 'sidebar-ring' },
    ],
  },
];

function ColorSwatch({ token, foreground }: ColorToken) {
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className="flex h-16 w-full items-center justify-center rounded-md border"
        // Tailwind v4의 @theme inline은 유틸리티 클래스 생성 시 참조 변수 값을 직접
        // 인라인하고, `--color-<name>` 간접 변수 자체는 그 이름이 다른 곳에서
        // 리터럴로 더 쓰이는 극소수(destructive-foreground/scrim/scrim-foreground
        // 등, 2026-09-13 당시 신규 추가분)만 실제로 :root에 남긴다 - primary-
        // foreground 등 나머지 대부분은 :root에 존재하지 않아 var()가 무효가
        // 되고, color(상속 속성)라 body의 text-foreground로 조용히 폴백됐다
        // (2026-09-16 a11y 게이트가 잘못된 대비로 처음 발견 - 실측: getComputedStyle
        // 로 --color-primary-foreground는 빈 문자열, --primary-foreground는
        // 정상값). :root/.dark에 항상 존재하는 원본 이름(--<name>)을 직접 읽는다.
        style={{ backgroundColor: `var(--${token})` }}
      >
        {foreground && (
          <span className="text-xs font-medium" style={{ color: `var(--${foreground})` }}>
            Aa
          </span>
        )}
      </div>
      <code className="text-xs text-muted-foreground">--{token}</code>
    </div>
  );
}

// 원본에 색을 더하고 위 묶음에 넣지 않아도 카탈로그에서 빠지지 않게, 묶이지 않은 옛 이름을 따로 모은다(지금은 없다).
const GROUPED_COLOR_NAMES = new Set(
  COLOR_GROUPS.flatMap(({ tokens }) =>
    tokens.flatMap(({ token, foreground }) => [token, foreground])
  )
);
const UNGROUPED_PACKAGE_COLORS: ColorToken[] = TOKENS.filter(
  (token) => token.group === 'shadcn' && !GROUPED_COLOR_NAMES.has(token.name)
).map((token) => ({ token: token.name }));
const ALL_COLOR_GROUPS: ColorGroup[] =
  UNGROUPED_PACKAGE_COLORS.length > 0
    ? [...COLOR_GROUPS, { title: '묶음에 넣지 않은 범용 색', tokens: UNGROUPED_PACKAGE_COLORS }]
    : COLOR_GROUPS;

// 의미 색은 종류(이름의 첫 마디)마다 한 묶음이고 원본 순서대로 보인다. 글자 색은 칠한 상자로 보인다. 글자로 읽히는 모습은
// 배경 묶음의 Aa(그 배경에 얹는 글자 색)로 본다 - 노란 글자 색을 흰 바탕에 글자로 그리면 a11y 검사(대비)에 걸린다.
const SEMANTIC_KINDS = [
  { kind: 'fg', title: '글자(fg)', classPrefix: 'text-' },
  { kind: 'bg', title: '배경(bg)', classPrefix: 'bg-' },
  { kind: 'stroke', title: '선(stroke)', classPrefix: 'border-' },
] as const;
const SEMANTIC_COLORS = TOKENS.filter((token) => token.group === 'color');
const SHADCN_COLORS = TOKENS.filter((token) => token.group === 'shadcn');

/** 배경에 얹는 글자 색. 채움(solid)과 딤 배경은 짝(fg-on-…)이 있고, 나머지 표면은 기본 글자색이다 */
function textColorOn(background: DesignToken) {
  const pair = SEMANTIC_COLORS.find(
    (token) => token.name === background.name.replace(/^bg-/, 'fg-on-')
  );

  return (pair ?? SEMANTIC_COLORS.find((token) => token.name === 'fg-neutral'))?.cssVar;
}

function SemanticColorSwatch({
  token,
  kind,
  classPrefix,
}: { token: DesignToken } & (typeof SEMANTIC_KINDS)[number]) {
  const aliases = SHADCN_COLORS.filter((alias) => alias.value === `var(${token.cssVar})`).map(
    (alias) => alias.name
  );
  const textColor = kind === 'bg' ? textColorOn(token) : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          'flex h-16 w-full items-center justify-center rounded-md',
          kind === 'stroke' ? 'border-2' : 'border'
        )}
        style={
          kind === 'stroke'
            ? { borderColor: `var(${token.cssVar})` }
            : { backgroundColor: `var(${token.cssVar})` }
        }
      >
        {textColor && (
          <span className="text-xs font-medium" style={{ color: `var(${textColor})` }}>
            Aa
          </span>
        )}
      </div>
      <code className="text-xs text-muted-foreground">
        {classPrefix}
        {token.name}
      </code>
      {aliases.length > 0 && (
        <span className="text-xs text-muted-foreground">옛 이름: {aliases.join(', ')}</span>
      )}
    </div>
  );
}

function ColorsCatalog() {
  return (
    <div className="flex flex-col gap-8 p-4">
      {SEMANTIC_KINDS.map((semanticKind) => (
        <div key={semanticKind.kind} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{semanticKind.title}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {SEMANTIC_COLORS.filter((token) => token.name.startsWith(`${semanticKind.kind}-`)).map(
              (token) => (
                <SemanticColorSwatch key={token.name} token={token} {...semanticKind} />
              )
            )}
          </div>
        </div>
      ))}
      {ALL_COLOR_GROUPS.map((group) => (
        <div key={group.title} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold">{group.title}</h3>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {group.tokens.map((t) => (
              <ColorSwatch key={t.token} {...t} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

const RADIUS_TOKENS = TOKENS.filter((token) => token.group === 'radius');

function RadiusCatalog() {
  return (
    <div className="flex gap-6 p-4">
      {RADIUS_TOKENS.map(({ name, cssVar }) => (
        <div key={name} className="flex flex-col items-center gap-2">
          <div
            className="h-16 w-16 border-2 border-primary bg-muted"
            style={{ borderRadius: `var(${cssVar})` }}
          />
          <code className="text-xs text-muted-foreground">rounded-{name}</code>
        </div>
      ))}
    </div>
  );
}

// 원본은 값이 작은 순서다. 여기서는 값이 큰 순서(위로 올라오는 순서)로 보인다. 쓰임 설명은 원본의 설명이다.
const Z_INDEX_LAYERS = TOKENS.filter((token) => token.group === 'z-index').reverse();

function ZIndexCatalog() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Z_INDEX_LAYERS.map(({ name, cssVar, description }) => (
        <div
          key={name}
          className="flex items-center gap-4 rounded-md border bg-card px-4 py-2"
          style={{ zIndex: `var(${cssVar})` }}
        >
          <code className="w-40 shrink-0 text-xs text-muted-foreground">z-{name}</code>
          <span className="text-sm">{description}</span>
        </div>
      ))}
    </div>
  );
}

// 글자 크기 눈금(t1~t14). 값 출처는 https://seed-design.io/foundations/typography - t11~t14는 sm 이상 권장이라는
// 표시를 함께 보여준다.
const TYPOGRAPHY_SCALE = TOKENS.filter((token) => token.group === 'font-size');
const LARGE_TITLE_SCALE = new Set<string>(['t11', 't12', 't13', 't14']);

function TypographyCatalog() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {TYPOGRAPHY_SCALE.map(({ name, cssVar }) => (
        <div key={name} className="flex items-baseline gap-4 border-b pb-3">
          <code className="w-28 shrink-0 text-xs text-muted-foreground">
            {cssVar}
            {LARGE_TITLE_SCALE.has(name) && ' (sm~)'}
          </code>
          <span style={{ fontSize: `var(${cssVar})`, lineHeight: `var(${cssVar}--line-height)` }}>
            텍스트 스케일 미리보기 Aa 12
          </span>
        </div>
      ))}
    </div>
  );
}

// 글자 역할 토큰. 눈금(t1~t14)에서 실제 화면에 쓰이는 값만 골라 이름 붙인 것 - TYPOGRAPHY_SCALE과 달리 매 항목이
// 곧 실제 컴포넌트가 쓰는 클래스다. 역할 하나가 글자 크기·줄 높이·두께 토큰으로 나뉘어 있어 글자 크기 토큰으로 역할을 센다.
const ROLE_TOKENS = TOKENS.filter((token) => token.group === 'text' && token.part === 'font-size');

function RoleTokensCatalog() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {ROLE_TOKENS.map(({ name, cssVar, description }) => (
        <div key={name} className="flex items-baseline gap-4 border-b pb-4">
          <code className="w-44 shrink-0 text-xs text-muted-foreground">{cssVar}</code>
          <span
            style={{
              fontSize: `var(${cssVar})`,
              lineHeight: `var(${cssVar}--line-height)`,
              fontWeight: `var(${cssVar}--font-weight, 400)`,
            }}
          >
            {description}
          </span>
        </div>
      ))}
    </div>
  );
}

// 시간·곡선 토큰. 시간은 원본 순서, 곡선은 같은 시간(d12)에 곡선만 바꿔 비교한다. 값과 쓰임 설명은 원본에서 읽는다.
// 당근 SEED의 Motion 문서(https://seed-design.io/foundations/motion)는 값 표만 둔다. 곡선은 숫자만으로 차이가 안 보여
// 여기서는 표 옆에 재생 예시를 함께 둔다(2026-11-26 사용자 결정).
const MOTION_SECTIONS: {
  title: string;
  prefix: string;
  tokens: DesignToken[];
  timing: (cssVar: string) => CSSProperties;
}[] = [
  {
    title: '시간',
    prefix: 'duration',
    tokens: TOKENS.filter((token) => token.group === 'duration'),
    timing: (cssVar) => ({ transitionDuration: `var(${cssVar})` }),
  },
  {
    title: '가속 곡선(모두 d12, 600ms로 움직인다)',
    prefix: 'ease',
    tokens: TOKENS.filter((token) => token.group === 'timing-function'),
    timing: (cssVar) => ({
      transitionDuration: 'var(--transition-duration-d12)',
      transitionTimingFunction: `var(${cssVar})`,
    }),
  },
];

/** 별칭이면 가리키는 변수도 보인다(color-transition = var(--transition-duration-d3) = 150ms) */
function motionValue({ value, resolved }: DesignToken) {
  return value === resolved ? resolved : `${resolved} (${value})`;
}

// 동작 줄이기에서는 점이 움직이지 않고 흐려지기만 한다(토큰 CSS의 동작 줄이기 규칙과 같은 원칙)
function MotionTrack({ played, timing }: { played: boolean; timing: CSSProperties }) {
  return (
    <div className="relative h-4 w-48 shrink-0 rounded-full bg-muted">
      <div
        className={cn(
          'absolute left-0 top-0 size-4 rounded-full bg-primary transition-[translate,opacity]',
          played && 'motion-safe:translate-x-44 motion-reduce:opacity-30'
        )}
        style={timing}
      />
    </div>
  );
}

function MotionCatalog() {
  const [played, setPlayed] = useState(false);

  return (
    <div className="flex flex-col gap-6 p-4">
      <Button
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => setPlayed((value) => !value)}
      >
        {played ? '되돌리기' : '재생'}
      </Button>
      {MOTION_SECTIONS.map(({ title, prefix, tokens, timing }) => (
        <div key={title} className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {tokens.map((token) => (
            <div
              key={token.name}
              className="flex items-center gap-4 rounded-md border bg-card px-4 py-2"
            >
              <code className="w-44 shrink-0 text-xs text-muted-foreground">
                {prefix}-{token.name}
              </code>
              <MotionTrack played={played} timing={timing(token.cssVar)} />
              <code className="w-56 shrink-0 text-xs">{motionValue(token)}</code>
              <span className="text-sm">{token.description}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// 그림자 토큰. 값과 쓰임 설명은 원본에서 읽는다. 그림자가 잘 보이도록 카드 색 상자를 바탕 위에 띄운다
const SHADOW_TOKENS = TOKENS.filter((token) => token.group === 'shadow');

function ShadowCatalog() {
  return (
    <div className="flex flex-col gap-6 bg-background p-6">
      {SHADOW_TOKENS.map(({ name, cssVar, value, description }) => (
        <div key={name} className="flex items-center gap-6">
          <div
            className="h-16 w-24 shrink-0 rounded-lg bg-card"
            style={{ boxShadow: `var(${cssVar})` }}
          />
          <div className="flex flex-col gap-1">
            <code className="text-xs text-muted-foreground">shadow-{name}</code>
            <code className="text-xs">{value}</code>
            <span className="text-sm">{description}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

// 역할 간격 토큰. 값과 쓰임 설명은 원본에서 읽는다. 피드 카드의 태그 줄과 같은 배지를 좁은 상자에 늘어놓아 줄바꿈 간격까지 보인다
const SPACING_TOKENS = TOKENS.filter((token) => token.group === 'spacing');
const SAMPLE_CHIP_LABELS = ['리액트', '타입스크립트', '디자인 시스템', '접근성', '성능', '테스트'];

function SpacingCatalog() {
  return (
    <div className="flex flex-col gap-6 bg-background p-6">
      {SPACING_TOKENS.map(({ name, cssVar, value, description }) => (
        <div key={name} className="flex flex-col gap-2">
          <div className="flex w-56 flex-wrap" style={{ gap: `var(${cssVar})` }}>
            {SAMPLE_CHIP_LABELS.map((label) => (
              <Badge key={label} variant="secondary" className="text-xs">
                {label}
              </Badge>
            ))}
          </div>
          <code className="text-xs text-muted-foreground">gap-{name}</code>
          <code className="text-xs">{value}</code>
          <span className="text-sm">{description}</span>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Shared/UI/Tokens/DesignTokens',
  tags: ['autodocs'],
} satisfies Meta;

// eslint-disable-next-line import/no-default-export
export default meta;
type Story = StoryObj<typeof meta>;

export const Colors: Story = {
  render: () => <ColorsCatalog />,
};

export const ZIndex: Story = {
  render: () => <ZIndexCatalog />,
};

export const Radius: Story = {
  render: () => <RadiusCatalog />,
};

export const Typography: Story = {
  render: () => <TypographyCatalog />,
};

export const RoleTokens: Story = {
  render: () => <RoleTokensCatalog />,
};

export const Motion: Story = {
  render: () => <MotionCatalog />,
};

export const Shadow: Story = {
  render: () => <ShadowCatalog />,
};

export const Spacing: Story = {
  render: () => <SpacingCatalog />,
};
