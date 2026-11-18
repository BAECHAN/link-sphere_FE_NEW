import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: no-literal-jsx-text-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { noStoryNameRule } from '../../../scripts/lib/no-story-name-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser },
});

const oneError = [{ messageId: 'storyName' }];

ruleTester.run('no-story-name', noStoryNameRule, {
  valid: [
    // 이름은 export 이름에서 나온다
    'export const Uncontrolled: Story = { render: () => null };',
    'export const Default = {} satisfies Story;',
    // 컴포넌트 prop으로 쓰는 name은 스토리 이름이 아니다
    "export const Default: Story = { args: { name: 'username' } };",
    // meta(default export)는 보지 않는다
    "const meta = { title: 'Shared/UI/Atoms/Button', name: 'x' }; export default meta;",
    // 내보내지 않은 객체는 스토리가 아니다
    "const base = { name: 'x' };",
  ],
  invalid: [
    {
      code: "export const ClickToOpen: Story = { name: '비제어형 — click으로 열림' };",
      errors: oneError,
    },
    { code: "export const Primary = { name: 'I am the primary' };", errors: oneError },
    { code: "export const Primary = { name: 'Primary' } satisfies Story;", errors: oneError },
    { code: "export const Primary = { name: 'Primary' } as Story;", errors: oneError },
    { code: "export const Primary: Story = { 'name': 'Primary' };", errors: oneError },
    {
      code: "export const A: Story = { name: 'a' }, B: Story = { name: 'b' };",
      errors: [...oneError, ...oneError],
    },
  ],
});
