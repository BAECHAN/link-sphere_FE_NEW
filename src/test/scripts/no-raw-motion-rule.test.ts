import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: no-story-name-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { noRawMotionRule } from '../../../scripts/lib/no-raw-motion-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

// 막는 클래스와 앱이 쓰지 않는 클래스(변형이 붙은 토큰 클래스)는 조각을 이어 만든다.
// 이름을 글자 그대로 적으면 Tailwind가 이 파일에서 찾아 쓰지 않는 유틸리티를 CSS에 만든다
const raw = (...parts: string[]) => parts.join('-');
const error = (value: string) => [{ messageId: 'rawMotion', data: { value } }];

ruleTester.run('no-raw-motion', noRawMotionRule, {
  valid: [
    // 토큰 클래스
    "const a = 'transition-all duration-d4 ease-easing';",
    `const b = 'animate-in fade-in duration-d12 ease-enter ${raw('md:duration', 'color-transition')}';`,
    `const c = '${raw('data-[state=open]:duration', 'd6')} ${raw('data-[state=open]:ease', 'sheet')}';`,
    // 변수 이름에 든 duration은 클래스가 아니다
    "const d = 'var(--transition-duration-d4)';",
    "const e = { '--tw-duration': '1s' };",
    // 막는 이름과 앞부분만 같은 토큰 이름
    "const f = 'ease-enter ease-easing';",
    // delay는 토큰이 없어 보지 않는다
    `const g = '${raw('delay', '150')}';`,
    // 시간을 정하는 클래스가 아닌 낱말
    "const h = 'transition-duration는 CSS 속성 이름';",
  ],
  invalid: [
    // 숫자 시간
    { code: `const a = '${raw('duration', '200')}';`, errors: error(raw('duration', '200')) },
    {
      code: `const b = 'transition-all ${raw('hover:duration', '300')}';`,
      errors: error(raw('duration', '300')),
    },
    // 대괄호·괄호 값
    {
      code: `const c = '${raw('duration', '[250ms]')}';`,
      errors: error(raw('duration', '[250ms]')),
    },
    {
      code: `const d = '${raw('ease', '[cubic-bezier(0.32,0.72,0,1)]')}';`,
      errors: error(raw('ease', '[cubic-bezier(0.32,0.72,0,1)]')),
    },
    {
      code: `const e = '${raw('ease', '(--my-ease)')}';`,
      errors: error(raw('ease', '(--my-ease)')),
    },
    // Tailwind 기본 이름
    { code: `const f = '${raw('ease', 'in-out')}';`, errors: error(raw('ease', 'in-out')) },
    { code: `const g = '${raw('ease', 'out')}';`, errors: error(raw('ease', 'out')) },
    { code: `const h = '${raw('ease', 'in')}';`, errors: error(raw('ease', 'in')) },
    { code: `const i = '${raw('ease', 'linear')}';`, errors: error(raw('ease', 'linear')) },
    {
      code: `const j = '${raw('duration', 'initial')}';`,
      errors: error(raw('duration', 'initial')),
    },
    // 템플릿 문자열과 JSX 속성
    {
      code: `const k = \`fade-in \${x} ${raw('duration', '150')}\`;`,
      errors: error(raw('duration', '150')),
    },
    {
      code: `const l = <div className="${raw('ease', 'out')} duration-d4" />;`,
      errors: error(raw('ease', 'out')),
    },
  ],
});
