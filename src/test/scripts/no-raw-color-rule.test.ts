import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: no-raw-shadow-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { noRawColorRule } from '../../../scripts/lib/no-raw-color-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

// 막는 클래스와 앱이 아직 쓰지 않는 클래스(의미 색 등)는 조각을 이어 만든다.
// 이름을 글자 그대로 적으면 Tailwind가 이 파일에서 찾아 쓰지 않는 유틸리티를 CSS에 만든다
const raw = (...parts: string[]) => parts.join('-');
const withVariant = (variant: string, className: string) => [variant, className].join(':');
const error = (value: string) => [{ messageId: 'rawColor', data: { value } }];

ruleTester.run('no-raw-color', noRawColorRule, {
  valid: [
    // 토큰 클래스
    "const a = 'bg-scrim text-destructive border-border';",
    // 의미 색 이름의 가운데 마디가 팔레트 이름과 같아도(neutral) 팔레트 클래스가 아니다
    `const b = '${raw('bg', 'bg', 'neutral', 'muted')} ${raw('bg', 'bg', 'neutral', 'weak')}';`,
    `const c = '${raw('border', 'stroke', 'neutral', 'weak')} ${raw('ring', 'stroke', 'neutral', 'weak')}';`,
    `const d = '${raw('text', 'fg', 'neutral')} ${withVariant('hover', raw('text', 'fg', 'neutral', 'muted'))}';`,
    // 변수 이름에 든 팔레트 이름
    "const e = 'var(--bui-color-palette-gray-900) var(--bui-color-palette-white)';",
  ],
  invalid: [
    // 검정·흰색과 투명도
    { code: `const a = '${raw('bg', 'white')}/10';`, errors: error(raw('bg', 'white')) },
    { code: `const b = '${raw('text', 'black')}';`, errors: error(raw('text', 'black')) },
    // 명명 팔레트와 단계
    { code: `const c = '${raw('text', 'red', '500')}';`, errors: error(raw('text', 'red', '500')) },
    {
      code: `const d = '${raw('border', 'neutral', '200')}';`,
      errors: error(raw('border', 'neutral', '200')),
    },
    // 단계가 없거나 Tailwind에 없는 단계
    { code: `const e = 'p-2 ${raw('bg', 'gray')}';`, errors: error(raw('bg', 'gray')) },
    { code: `const f = '${raw('bg', 'gray', '550')}';`, errors: error(raw('bg', 'gray')) },
    // 변형이 붙은 꼴
    {
      code: `const g = '${withVariant('hover', raw('bg', 'gray', '100'))}';`,
      errors: error(raw('bg', 'gray', '100')),
    },
    // 템플릿 문자열과 JSX 속성
    {
      code: `const h = \`card \${x} ${raw('ring', 'zinc', '400')}\`;`,
      errors: error(raw('ring', 'zinc', '400')),
    },
    {
      code: `const i = <div className="${raw('fill', 'white')} rounded-md" />;`,
      errors: error(raw('fill', 'white')),
    },
    // 하이픈으로 이어진 유틸리티(안쪽 그림자, 안쪽 링, 드롭 그림자, 글자 그림자)
    {
      code: `const j = '${raw('inset', 'shadow', 'white')}';`,
      errors: error(raw('inset', 'shadow', 'white')),
    },
    {
      code: `const k = '${raw('inset', 'ring', 'black')}/10';`,
      errors: error(raw('inset', 'ring', 'black')),
    },
    {
      code: `const l = '${raw('drop', 'shadow', 'black')}';`,
      errors: error(raw('drop', 'shadow', 'black')),
    },
    {
      code: `const m = '${raw('text', 'shadow', 'gray', '900')}';`,
      errors: error(raw('text', 'shadow', 'gray', '900')),
    },
  ],
});
