import { describe, expect, it } from 'vitest';
import { TOKENS } from '@baechan/ui/tokens';
import { buildTokenCss, ruleBody } from '@/test/tailwind-compile';

// 그림자 토큰은 Tailwind 테마 키 --shadow-*로 내보내 shadow-<이름> 클래스가 되게 한다. shadow-<이름>은 변수를 가리키지 않고
// 테마 값을 규칙에 그대로 넣으면서 층마다 색을 --tw-shadow-color로 바꿀 수 있게 감싼다(Tailwind 4.3.5에서 컴파일해 확인).
// 그래서 변수가 출력에 남는지(@theme static, 카탈로그가 읽는다)와 규칙의 값이 토큰 값인지를 따로 본다
const shadowTokens = TOKENS.filter((token) => token.group === 'shadow').map(
  ({ name, cssVar, resolved }) => [name, cssVar, resolved]
);

describe('Tailwind가 그림자 토큰을 클래스로 만든다', () => {
  it('토큰 목록에 그림자 토큰이 있다', () => {
    expect(shadowTokens.map(([name]) => name)).toEqual(['s1', 's2', 's3', 's4']);
  });

  it.each(shadowTokens)('shadow-%s가 %s의 값을 쓴다', async (name, cssVar, resolved) => {
    const css = await buildTokenCss([`shadow-${name}`]);
    const withColorSlot = resolved.replace(
      /oklch\([^)]*\)/g,
      (color) => `var(--tw-shadow-color, ${color})`
    );

    expect(ruleBody(css, `shadow-${name}`)).toContain(`--tw-shadow: ${withColorSlot};`);
    expect(css).toContain(`${cssVar}: ${resolved};`);
  });
});
