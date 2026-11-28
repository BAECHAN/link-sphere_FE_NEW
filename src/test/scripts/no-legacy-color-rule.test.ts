import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
import { TOKENS } from '@baechan/ui/tokens';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: semantic-color-kind-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import {
  LEGACY_COLOR_NAMES,
  noLegacyColorRule,
} from '../../../scripts/lib/no-legacy-color-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

// 클래스 이름은 조각을 이어 만든다. 글자 그대로 적으면 Tailwind가 이 파일에서 찾아 쓰지 않는 유틸리티를 CSS에 만든다
const raw = (...parts: string[]) => parts.join('-');
const withVariant = (variant: string, className: string) => [variant, className].join(':');

function legacy(value: string) {
  return { messageId: 'legacyColor', data: { value } };
}

describe('LEGACY_COLOR_NAMES', () => {
  // 요구: 규칙이 막는 이름은 토큰 원본의 옛 shadcn 이름 전부다(2026-11-27 게이트 3 ④)
  it('토큰 원본의 옛 shadcn 이름과 같다', () => {
    const fromSource = TOKENS.filter((token) => token.group === 'shadcn').map((token) =>
      token.id.replace(/^shadcn\./, '')
    );

    expect([...LEGACY_COLOR_NAMES].sort()).toEqual([...fromSource].sort());
  });
});

ruleTester.run('no-legacy-color', noLegacyColorRule, {
  valid: [
    // 새 의미 색 이름(가운데 마디가 옛 이름과 같아도 통과)
    `const a = '${raw('text', 'fg', 'neutral')} ${raw('bg', 'bg', 'warning', 'solid')} ${raw('border', 'stroke', 'brand', 'solid')}';`,
    `const b = '${raw('ring', 'bg', 'layer', 'basement')} ${raw('text', 'fg', 'on', 'warning', 'solid')}';`,
    // 색이 아닌 같은 낱말: 너비만 주는 테두리·링, 변수 이름, 앱 전용 색 이름의 꼬리
    "const c = 'border ring-2 border-b var(--muted-foreground) var(--color-primary)';",
    `const d = '${raw('bg', 'sidebar', 'accent')} ${raw('text', 'sidebar', 'accent', 'foreground')}';`,
    // 옛 이름이 뒤에 더 붙은 다른 이름
    `const e = '${raw('text', 'primary', 'soft')}';`,
  ],
  invalid: [
    {
      code: `const a = '${raw('text', 'muted', 'foreground')}';`,
      errors: [legacy(raw('text', 'muted', 'foreground'))],
    },
    // 변형과 투명도가 붙은 꼴
    {
      code: `const b = '${withVariant('hover', raw('bg', 'accent'))}/50';`,
      errors: [legacy(raw('bg', 'accent'))],
    },
    // 선 유틸리티: 한쪽 면, 링, 링 바깥 여백
    {
      code: `const c = '${raw('border', 't', 'primary')} ${raw('ring', 'offset', 'background')} ${raw('ring', 'ring')}';`,
      errors: [
        legacy(raw('border', 't', 'primary')),
        legacy(raw('ring', 'offset', 'background')),
        legacy(raw('ring', 'ring')),
      ],
    },
    // 긴 이름이 먼저 맞는다(짧은 이름에서 끊지 않는다)
    {
      code: `const d = '${raw('text', 'warning', 'foreground')}';`,
      errors: [legacy(raw('text', 'warning', 'foreground'))],
    },
    // 템플릿 문자열과 JSX 속성
    {
      code: `const e = \`card \${x} ${raw('border', 'border')}\`;`,
      errors: [legacy(raw('border', 'border'))],
    },
    {
      code: `const f = <div className="${raw('bg', 'background')} ${raw('text', 'foreground')}" />;`,
      errors: [legacy(raw('bg', 'background')), legacy(raw('text', 'foreground'))],
    },
  ],
});
