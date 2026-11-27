import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: no-raw-shadow-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { semanticColorKindRule } from '../../../scripts/lib/semantic-color-kind-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

// 의미 색 클래스는 앱이 아직 쓰지 않아 조각을 이어 만든다.
// 이름을 글자 그대로 적으면 Tailwind가 이 파일에서 찾아 쓰지 않는 유틸리티를 CSS에 만든다
const raw = (...parts: string[]) => parts.join('-');
const withVariant = (variant: string, className: string) => [variant, className].join(':');

// 요구: 글자 유틸리티는 fg, 배경 유틸리티는 bg, 선 유틸리티는 stroke 색을 받는다(2026-11-27 게이트 3)
const LABEL = { fg: '글자(fg)', bg: '배경(bg)', stroke: '선(stroke)' } as const;
type Kind = keyof typeof LABEL;

function wrongKind(utility: string, color: string, expected: Kind, actual: Kind) {
  return {
    messageId: 'wrongKind',
    data: {
      value: `${utility}-${color}`,
      utility,
      color,
      expected: LABEL[expected],
      actual: LABEL[actual],
    },
  };
}

ruleTester.run('semantic-color-kind', semanticColorKindRule, {
  valid: [
    // 글자
    `const a = '${raw('text', 'fg', 'neutral')} ${raw('placeholder', 'fg', 'placeholder')} ${raw('decoration', 'fg', 'brand')} ${raw('caret', 'fg', 'neutral')}';`,
    // 배경(그라데이션 포함)
    `const b = '${raw('bg', 'bg', 'layer', 'default')} ${raw('from', 'bg', 'overlay')} ${raw('via', 'bg', 'overlay')} ${raw('to', 'bg', 'layer', 'basement')}';`,
    // 선(한쪽 면, 링, 링 바깥 여백, 외곽선, 구분선)
    `const c = '${raw('border', 'stroke', 'neutral', 'weak')} ${raw('border', 't', 'stroke', 'neutral', 'weak')} ${raw('ring', 'stroke', 'focus', 'ring')} ${raw('ring', 'offset', 'stroke', 'focus', 'ring')}';`,
    `const d = '${raw('inset', 'ring', 'stroke', 'brand', 'solid')} ${raw('outline', 'stroke', 'focus', 'ring')} ${raw('divide', 'stroke', 'neutral', 'weak')}';`,
    // 변형과 투명도
    `const e = '${withVariant('hover', raw('bg', 'bg', 'transparent', 'pressed'))}/50';`,
    // 옛 shadcn 이름은 종류가 이름에 없어 보지 않는다
    "const f = 'bg-background text-foreground border-border bg-border';",
    // 보지 않는 유틸리티: SVG의 fill·stroke, 그림자·accent 색
    `const g = '${raw('fill', 'bg', 'brand', 'solid')} ${raw('stroke', 'fg', 'neutral')} ${raw('shadow', 'fg', 'neutral')} ${raw('accent', 'bg', 'brand', 'solid')}';`,
    // 변수 이름
    "const h = 'var(--bui-color-fg-neutral) var(--bui-color-bg-layer-default)';",
    // 글자 크기 클래스
    `const i = '${raw('text', 't5')} text-screen-title';`,
  ],
  invalid: [
    {
      code: `const a = '${raw('text', 'bg', 'brand', 'solid')}';`,
      errors: [wrongKind('text', raw('bg', 'brand', 'solid'), 'fg', 'bg')],
    },
    {
      code: `const b = '${raw('bg', 'fg', 'neutral')}';`,
      errors: [wrongKind('bg', raw('fg', 'neutral'), 'bg', 'fg')],
    },
    {
      code: `const c = '${raw('border', 'fg', 'neutral', 'muted')}/10';`,
      errors: [wrongKind('border', raw('fg', 'neutral', 'muted'), 'stroke', 'fg')],
    },
    {
      code: `const d = '${raw('border', 'b', 'bg', 'neutral', 'muted')}';`,
      errors: [wrongKind(raw('border', 'b'), raw('bg', 'neutral', 'muted'), 'stroke', 'bg')],
    },
    {
      code: `const e = '${raw('ring', 'bg', 'layer', 'basement')}';`,
      errors: [wrongKind('ring', raw('bg', 'layer', 'basement'), 'stroke', 'bg')],
    },
    {
      code: `const f = '${raw('ring', 'offset', 'bg', 'layer', 'basement')}';`,
      errors: [wrongKind(raw('ring', 'offset'), raw('bg', 'layer', 'basement'), 'stroke', 'bg')],
    },
    {
      code: `const g = '${raw('divide', 'bg', 'neutral', 'weak')}';`,
      errors: [wrongKind('divide', raw('bg', 'neutral', 'weak'), 'stroke', 'bg')],
    },
    {
      code: `const h = '${raw('to', 'stroke', 'brand', 'solid')}';`,
      errors: [wrongKind('to', raw('stroke', 'brand', 'solid'), 'bg', 'stroke')],
    },
    // 한 문자열에 둘
    {
      code: `const i = '${raw('text', 'bg', 'overlay')} p-2 ${raw('bg', 'stroke', 'brand', 'solid')}';`,
      errors: [
        wrongKind('text', raw('bg', 'overlay'), 'fg', 'bg'),
        wrongKind('bg', raw('stroke', 'brand', 'solid'), 'bg', 'stroke'),
      ],
    },
    // 템플릿 문자열과 JSX 속성(변형이 붙은 꼴)
    {
      code: `const j = \`card \${x} ${raw('outline', 'fg', 'brand')}\`;`,
      errors: [wrongKind('outline', raw('fg', 'brand'), 'stroke', 'fg')],
    },
    {
      code: `const k = <div className="${withVariant('hover', raw('text', 'stroke', 'focus', 'ring'))}" />;`,
      errors: [wrongKind('text', raw('stroke', 'focus', 'ring'), 'fg', 'stroke')],
    },
  ],
});
