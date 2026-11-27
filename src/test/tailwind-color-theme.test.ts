import { describe, expect, it } from 'vitest';
import { TOKENS } from '@baechan/ui/tokens';
import { buildTokenCss, ruleBody } from '@/test/tailwind-compile';

// 의미 색(2026-11-27 게이트 3)은 @theme inline의 --color-<이름>으로 내보내 글자·배경·선 클래스가 된다. inline이라 규칙은 테마 키를
// 거치지 않고 토큰 변수(--bui-color-…)를 바로 읽는다. 옛 shadcn 이름은 변수 이름이 예전 그대로라, 이미 쓰는 클래스의 규칙이 바뀌지 않는다.
// 클래스 이름은 목록에서 읽어 만든다. 글자 그대로 적으면 Tailwind가 이 파일에서 찾아 쓰지 않는 규칙을 만든다
const UTILITY_BY_KIND = {
  fg: { utility: 'text', property: 'color' },
  bg: { utility: 'bg', property: 'background-color' },
  stroke: { utility: 'border', property: 'border-color' },
} as const;
type SemanticKind = keyof typeof UTILITY_BY_KIND;

const semanticColors = TOKENS.filter((token) => token.group === 'color').map(
  ({ name, cssVar }) => [name, cssVar] as const
);
const shadcnColors = TOKENS.filter((token) => token.group === 'shadcn').map(
  ({ name, cssVar }) => [name, cssVar] as const
);
// 다크에서 최종 값이 달라지는 색. 안쪽 요소에 붙은 .dark에서도 다크 값을 따르려면 .dark 블록이 그 변수를 다시 적어야 한다
// (CSS 변수 안의 var()는 그 변수를 적은 요소에서 풀린다)
const modeDependentColors = TOKENS.filter(
  (token) => ['color', 'shadcn'].includes(token.group) && token.darkResolved !== token.resolved
).map(({ cssVar }) => cssVar);

function declarationsOf(css: string, selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  return new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`).exec(css)?.[1] ?? '';
}

describe('Tailwind가 의미 색을 클래스로 만든다', () => {
  it('토큰 목록에 의미 색과 옛 shadcn 이름이 있다', () => {
    expect(semanticColors.length).toBeGreaterThan(0);
    expect(shadcnColors.length).toBeGreaterThan(0);
  });

  it.each(semanticColors)('%s 클래스가 %s를 읽는다', async (name, cssVar) => {
    const { utility, property } = UTILITY_BY_KIND[name.split('-')[0] as SemanticKind];
    const className = `${utility}-${name}`;
    const css = await buildTokenCss([className]);

    expect(ruleBody(css, className)).toContain(`${property}: var(${cssVar});`);
  });

  it.each(shadcnColors)('옛 이름 %s의 클래스가 예전처럼 %s를 읽는다', async (name, cssVar) => {
    const className = `bg-${name}`;
    const css = await buildTokenCss([className]);

    expect(cssVar).toBe(`--${name}`);
    expect(ruleBody(css, className)).toContain(`background-color: var(${cssVar});`);
  });
});

describe('다크에서 값이 바뀌는 색을 .dark가 모두 다시 적는다', () => {
  it('다크에서 바뀌는 색이 있다', () => {
    expect(modeDependentColors).toContain('--background');
  });

  it.each(modeDependentColors)('.dark가 %s를 적는다', async (cssVar) => {
    const css = await buildTokenCss([]);

    expect(declarationsOf(css, '.dark')).toContain(`${cssVar}: `);
  });
});
