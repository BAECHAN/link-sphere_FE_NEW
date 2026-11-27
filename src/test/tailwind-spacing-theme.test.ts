import { describe, expect, it } from 'vitest';
import { TOKENS } from '@baechan/ui/tokens';
import { buildTokenCss, ruleBody } from '@/test/tailwind-compile';

// 역할 간격 토큰은 Tailwind 문서의 간격 이름공간 --spacing-*로 내보내 gap-<이름> 클래스가 되게 한다. 변수가 출력에 남는지
// (@theme static, 카탈로그가 읽는다)와 규칙이 그 변수를 가리키는지를 따로 본다
const spacingTokens = TOKENS.filter((token) => token.group === 'spacing').map(
  ({ name, cssVar, value }) => [name, cssVar, value]
);
// 옮기기 전에 쓰던 숫자 간격 클래스. 조각을 이어 만든다 - 글자 그대로 적으면 앱의 Tailwind가 이 파일에서 찾아 쓰지 않는 규칙을 만든다
const numericGap = (step: number) => ['gap', step].join('-');

describe('Tailwind가 역할 간격 토큰을 클래스로 만든다', () => {
  it('토큰 목록에 역할 간격 토큰이 있다', () => {
    expect(spacingTokens.map(([name]) => name)).toEqual(['between-chips']);
  });

  it.each(spacingTokens)('gap-%s가 %s를 쓴다', async (name, cssVar, value) => {
    const css = await buildTokenCss([`gap-${name}`]);

    expect(ruleBody(css, `gap-${name}`)).toContain(`gap: var(${cssVar});`);
    expect(css).toContain(`${cssVar}: ${value};`);
  });

  // 값을 0.5rem으로 둔 이유: 숫자 간격은 --spacing(0.25rem)의 배수라 브라우저 글자 크기를 바꿔도 함께 커진다. 토큰도 rem이어야
  // 어느 글자 크기에서든 옮기기 전과 같다
  it('칩 사이 간격이 옮기기 전 숫자 간격(눈금 2칸)과 같은 값이다', async () => {
    const css = await buildTokenCss([numericGap(2)]);

    expect(ruleBody(css, numericGap(2))).toContain('gap: calc(var(--spacing) * 2);');
    expect(css).toContain('--spacing: 0.25rem;');
    expect(spacingTokens).toContainEqual(['between-chips', '--spacing-between-chips', '0.5rem']);
  });
});
