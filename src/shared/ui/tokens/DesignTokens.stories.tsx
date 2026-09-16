import type { Meta, StoryObj } from '@storybook/react';

// 이 파일은 단일 컴포넌트가 아니라 src/app/globals.css의 디자인 토큰을 한눈에 보여주는
// 카탈로그다. 값을 복제하지 않고 CSS 커스텀 프로퍼티(var(--color-primary) 등)를 인라인
// style로 직접 읽어 렌더링한다 - 토큰이 바뀌면 이 스토리도 자동으로 따라간다.
// (Tailwind의 `bg-${token}`처럼 클래스명을 동적으로 조합하면 JIT 스캐너가 정적 문자열만
// 인식하기 때문에 생성되지 않는다 - 그래서 여기서는 클래스가 아니라 CSS 변수를 직접 쓴다.)
// 다크모드는 툴바의 테마 토글(.storybook/preview.tsx)로 확인한다.

interface ColorToken {
  /** Tailwind 색상 유틸리티 접미사 (bg-{token}) */
  token: string;
  /** 짝을 이루는 foreground 토큰이 있으면 그 위에 샘플 텍스트를 얹는다 */
  foreground?: string;
}

interface ColorGroup {
  title: string;
  tokens: ColorToken[];
}

// globals.css @theme inline 블록의 색 토큰과 1:1 대응.
const COLOR_GROUPS: ColorGroup[] = [
  {
    title: '기본',
    tokens: [{ token: 'background', foreground: 'foreground' }],
  },
  {
    title: '딤(Scrim) — 이미지 뷰어·모달 오버레이 전용, 테마 무관',
    tokens: [{ token: 'scrim', foreground: 'scrim-foreground' }],
  },
  {
    title: '표면',
    tokens: [
      { token: 'card', foreground: 'card-foreground' },
      { token: 'popover', foreground: 'popover-foreground' },
    ],
  },
  {
    title: '액션',
    tokens: [
      { token: 'primary', foreground: 'primary-foreground' },
      { token: 'secondary', foreground: 'secondary-foreground' },
      { token: 'muted', foreground: 'muted-foreground' },
      { token: 'accent', foreground: 'accent-foreground' },
    ],
  },
  {
    title: '상태',
    tokens: [
      { token: 'destructive', foreground: 'destructive-foreground' },
      { token: 'info', foreground: 'info-foreground' },
      { token: 'warning', foreground: 'warning-foreground' },
      { token: 'success', foreground: 'success-foreground' },
    ],
  },
  {
    title: '도메인 (link-sphere 고유 — 다른 프로젝트로 이식 시 재검토 대상)',
    tokens: [{ token: 'category', foreground: 'category-foreground' }],
  },
  {
    title: '폼 / 포커스',
    tokens: [{ token: 'border' }, { token: 'input' }, { token: 'ring' }],
  },
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
        style={{ backgroundColor: `var(--color-${token})` }}
      >
        {foreground && (
          <span className="text-xs font-medium" style={{ color: `var(--color-${foreground})` }}>
            Aa
          </span>
        )}
      </div>
      <code className="text-xs text-muted-foreground">--{token}</code>
    </div>
  );
}

function ColorsCatalog() {
  return (
    <div className="flex flex-col gap-8 p-4">
      {COLOR_GROUPS.map((group) => (
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

const RADIUS_TOKENS = ['sm', 'md', 'lg', 'xl'] as const;

function RadiusCatalog() {
  return (
    <div className="flex gap-6 p-4">
      {RADIUS_TOKENS.map((r) => (
        <div key={r} className="flex flex-col items-center gap-2">
          <div
            className="h-16 w-16 border-2 border-primary bg-muted"
            style={{ borderRadius: `var(--radius-${r})` }}
          />
          <code className="text-xs text-muted-foreground">rounded-{r}</code>
        </div>
      ))}
    </div>
  );
}

interface ZIndexLayer {
  token: string;
  usage: string;
}

// globals.css의 @theme static z-index 블록과 1:1 대응. 값이 큰 순서(위로 올라오는 순서)로
// 나열한다.
const Z_INDEX_LAYERS: ZIndexLayer[] = [
  { token: 'popover', usage: 'Dropdown / Select / Tooltip' },
  { token: 'modal', usage: 'Dialog' },
  { token: 'drawer', usage: 'Sidebar 패널' },
  { token: 'scrim', usage: 'Sidebar 백드롭 · MobileCommentBar 확장 시트 (같은 층 공유)' },
  { token: 'nav', usage: 'Navbar / BottomTabBar / FAB' },
  { token: 'panel', usage: 'RecentSearchPanel · MobileCommentBar 기본' },
  { token: 'hitbox', usage: '댓글 첨부 드롭 히트박스' },
  { token: 'raised', usage: '카드/폼 내부 오버레이' },
];

function ZIndexCatalog() {
  return (
    <div className="flex flex-col gap-2 p-4">
      {Z_INDEX_LAYERS.map(({ token, usage }) => (
        <div
          key={token}
          className="flex items-center gap-4 rounded-md border bg-card px-4 py-2"
          style={{ zIndex: `var(--z-index-${token})` }}
        >
          <code className="w-40 shrink-0 text-xs text-muted-foreground">z-{token}</code>
          <span className="text-sm">{usage}</span>
        </div>
      ))}
    </div>
  );
}

// globals.css @theme static 타이포 스케일 블록(t1~t14)과 1:1 대응. 값 출처는
// https://seed-design.io/foundations/typography - t11~t14는 sm 이상 권장이라는
// 표시를 함께 보여준다.
const TYPOGRAPHY_SCALE = [
  't1',
  't2',
  't3',
  't4',
  't5',
  't6',
  't7',
  't8',
  't9',
  't10',
  't11',
  't12',
  't13',
  't14',
] as const;
const LARGE_TITLE_SCALE = new Set(['t11', 't12', 't13', 't14']);

function TypographyCatalog() {
  return (
    <div className="flex flex-col gap-3 p-4">
      {TYPOGRAPHY_SCALE.map((t) => (
        <div key={t} className="flex items-baseline gap-4 border-b pb-3">
          <code className="w-28 shrink-0 text-xs text-muted-foreground">
            --text-{t}
            {LARGE_TITLE_SCALE.has(t) && ' (sm~)'}
          </code>
          <span
            style={{ fontSize: `var(--text-${t})`, lineHeight: `var(--text-${t}--line-height)` }}
          >
            텍스트 스케일 미리보기 Aa 12
          </span>
        </div>
      ))}
    </div>
  );
}

const meta = {
  title: 'Shared/UI/Tokens/Design Tokens',
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
