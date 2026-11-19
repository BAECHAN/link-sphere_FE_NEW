import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: ui-boundary-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { classNameLastRule, cvaVariantKeysRule } from '../../../scripts/lib/ui-api-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run('cva-variant-keys', cvaVariantKeysRule, {
  valid: [
    // 축이 하나면 variant
    "const iconVariants = cva('base', { variants: { variant: { info: 'a', success: 'b' } } });",
    // 종류와 크기
    "const buttonVariants = cva('base', { variants: { variant: { default: 'a' }, size: { sm: 'b' } }, defaultVariants: { variant: 'default', size: 'sm' } });",
    // 모양과 뜻을 따로 고르는 부품만 tone을 더한다
    "const badgeVariants = cva('base', { variants: { variant: { solid: 'a', outline: 'b' }, tone: { success: 'c' } } });",
    // 따옴표로 적은 키
    "const x = cva('base', { variants: { 'variant': { a: 'a' }, 'size': { b: 'b' } } });",
    // 변형이 없는 cva, 설정이 객체가 아닌 호출
    "const labelVariants = cva('base');",
    "const y = cva('base', sharedConfig);",
    "const z = cva('base', { defaultVariants: {} });",
    // cva가 아닌 함수의 variants는 보지 않는다
    "const other = build('base', { variants: { tone: { a: 'a' } } });",
    "const motion = { variants: { color: { a: 'a' } } };",
  ],
  invalid: [
    // 뜻만 고르는 축 하나를 tone으로 적은 경우
    {
      code: "const iconVariants = cva('base', { variants: { tone: { info: 'a' } } });",
      errors: [{ messageId: 'toneAlone' }],
    },
    // 허용 목록 밖 이름
    {
      code: "const x = cva('base', { variants: { color: { red: 'a' } } });",
      errors: [{ messageId: 'key', data: { key: 'color' } }],
    },
    {
      code: "const x = cva('base', { variants: { variant: { a: 'a' }, kind: { b: 'b' }, 'intent': { c: 'c' } } });",
      errors: [
        { messageId: 'key', data: { key: 'kind' } },
        { messageId: 'key', data: { key: 'intent' } },
      ],
    },
    // 크기와 tone만 있고 variant가 없는 경우
    {
      code: "const x = cva('base', { variants: { size: { sm: 'a' }, tone: { info: 'b' } } });",
      errors: [{ messageId: 'toneAlone' }],
    },
    // 허용 목록 밖 이름과 홀로 선 tone이 함께 있는 경우(보고는 소스에 적힌 순서로 나온다)
    {
      code: "const x = cva('base', { variants: { tone: { info: 'a' }, appearance: { b: 'b' } } });",
      errors: [{ messageId: 'toneAlone' }, { messageId: 'key', data: { key: 'appearance' } }],
    },
  ],
});

ruleTester.run('classname-last', classNameLastRule, {
  valid: [
    // 맨 뒤
    "const a = cn('base', className);",
    "const b = cn('base', isActive && 'on', className);",
    'const c = cn(badgeVariants({ variant }), className);',
    // className이 없는 호출, 인자가 className 하나뿐인 호출
    "const d = cn('base', 'more');",
    'const e = cn(className);',
    // 부분을 꾸미는 속성은 이 규칙이 보지 않는다
    "const f = cn(activeClassName, 'shadow-sm');",
    "const g = cn('size-4', iconClassName);",
    // cva로 만든 함수에 변형만 넘긴다
    "const buttonVariants = cva('base', { variants: { variant: { a: 'a' } } }); const h = cn(buttonVariants({ variant, size }), className);",
    // cva로 만들지 않은 함수는 보지 않는다
    'const i = build({ className });',
    // cva 결과에 인자가 없는 호출
    "const labelVariants = cva('base'); const j = cn(labelVariants(), className);",
  ],
  invalid: [
    // 앞자리
    {
      code: "const a = cn(className, 'base');",
      errors: [{ messageId: 'notLast' }],
    },
    // 가운데
    {
      code: "const b = cn('base', className, isActive && 'on');",
      errors: [{ messageId: 'notLast' }],
    },
    // cva로 만든 함수에 className을 넘기는 형태
    {
      code: "const buttonVariants = cva('base', {}); const c = cn(buttonVariants({ variant, size, className }));",
      errors: [{ messageId: 'insideCva', data: { name: 'buttonVariants', key: 'className' } }],
    },
    // cva의 다른 이름 class
    {
      code: "const badgeVariants = cva('base', {}); const d = badgeVariants({ variant, class: className });",
      errors: [{ messageId: 'insideCva', data: { name: 'badgeVariants', key: 'class' } }],
    },
    // 호출이 선언보다 위에 있어도 잡는다
    {
      code: "function Chip({ className }) { return chipVariants({ className }); } const chipVariants = cva('base', {});",
      errors: [{ messageId: 'insideCva', data: { name: 'chipVariants', key: 'className' } }],
    },
  ],
});
