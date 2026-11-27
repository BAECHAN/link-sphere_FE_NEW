import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: no-raw-motion-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { noRawShadowRule } from '../../../scripts/lib/no-raw-shadow-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

// 막는 클래스와 앱이 쓰지 않는 클래스(변형이 붙은 토큰 클래스 등)는 조각을 이어 만든다.
// 이름을 글자 그대로 적으면 Tailwind가 이 파일에서 찾아 쓰지 않는 유틸리티를 CSS에 만든다. 변형은 따로 붙인다 -
// 변형과 클래스 앞부분을 한 조각으로 자르면 이름 없는 그림자 클래스에 변형이 붙은 꼴이 되어 그 규칙이 생긴다
const raw = (...parts: string[]) => parts.join('-');
const withVariant = (variant: string, className: string) => [variant, className].join(':');
const error = (value: string) => [{ messageId: 'rawShadow', data: { value } }];

ruleTester.run('no-raw-shadow', noRawShadowRule, {
  valid: [
    // 토큰 클래스와 그림자를 없애는 클래스
    "const a = 'rounded-md border shadow-s1';",
    `const b = 'shadow-s2 hover:shadow-s3 ${withVariant('data-[state=open]', 'shadow-s4')}';`,
    "const c = 'shadow-none sm:rounded-none';",
    // 변수 이름에 든 shadow는 클래스가 아니다
    "const d = 'var(--shadow-s4) var(--tw-shadow-color)';",
    // 다른 유틸리티의 일부(앞에 하이픈이 온다)
    `const e = '${raw('drop', 'shadow', 'md')} ${raw('inset', 'shadow', 'sm')} ${raw('text', 'shadow', 'lg')}';`,
    // 막는 이름과 앞부분만 같은 이름(그림자 색 등)
    `const f = '${raw('shadow', 'smoke')} ${raw('shadow', 'lg2')}';`,
    // 문자열 전체가 낱말 하나뿐이면 토큰 묶음 이름 같은 낱말이다(group === 'shadow')
    "const g = 'shadow';",
    "const h = 'box-shadow는 CSS 속성 이름';",
  ],
  invalid: [
    // Tailwind 기본 이름
    { code: `const a = '${raw('shadow', 'xs')}';`, errors: error(raw('shadow', 'xs')) },
    { code: `const b = '${raw('shadow', '2xs')}';`, errors: error(raw('shadow', '2xs')) },
    { code: `const c = '${raw('shadow', 'sm')}';`, errors: error(raw('shadow', 'sm')) },
    { code: `const d = '${raw('shadow', 'md')}';`, errors: error(raw('shadow', 'md')) },
    { code: `const e = '${raw('shadow', 'lg')}';`, errors: error(raw('shadow', 'lg')) },
    { code: `const f = '${raw('shadow', 'xl')}';`, errors: error(raw('shadow', 'xl')) },
    { code: `const g = '${raw('shadow', '2xl')}';`, errors: error(raw('shadow', '2xl')) },
    { code: `const h = '${raw('shadow', 'inner')}';`, errors: error(raw('shadow', 'inner')) },
    // 변형과 투명도가 붙은 꼴
    {
      code: `const i = 'transition-shadow ${withVariant('hover', raw('shadow', 'md'))}';`,
      errors: error(raw('shadow', 'md')),
    },
    { code: `const j = '${raw('shadow', 'lg')}/20';`, errors: error(raw('shadow', 'lg')) },
    // 대괄호·괄호 값
    {
      code: `const k = '${raw('shadow', '[0_0_10px_var(--color-primary)]')}';`,
      errors: error(raw('shadow', '[0_0_10px_var(--color-primary)]')),
    },
    {
      code: `const l = '${raw('shadow', '(--my-shadow)')}';`,
      errors: error(raw('shadow', '(--my-shadow)')),
    },
    // 템플릿 문자열과 JSX 속성
    {
      code: `const m = \`card \${x} ${raw('shadow', 'sm')}\`;`,
      errors: error(raw('shadow', 'sm')),
    },
    {
      code: `const n = <div className="${raw('shadow', 'lg')} rounded-md" />;`,
      errors: error(raw('shadow', 'lg')),
    },
    // 이름 없는 그림자(Tailwind 호환 테마의 기본값)는 다른 클래스와 함께 쓰거나 변형·투명도가 붙으면 막는다
    { code: "const o = 'rounded-md shadow transition-shadow';", errors: error('shadow') },
    { code: `const p = '${withVariant('hover', 'shadow')}';`, errors: error('shadow') },
    { code: `const q = '${['shadow', '50'].join('/')}';`, errors: error('shadow') },
    { code: 'const r = `${x} shadow`;', errors: error('shadow') },
  ],
});
