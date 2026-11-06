import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: no-literal-a11y-name-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { noLiteralJsxTextRule } from '../../../scripts/lib/no-literal-jsx-text-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

const oneError = [{ messageId: 'literalText' }];

ruleTester.run('no-literal-jsx-text', noLiteralJsxTextRule, {
  valid: [
    // TEXTS 참조와 값은 글자를 직접 적은 게 아니다
    '<h1>{TEXTS.post.list.heading}</h1>',
    '<span>{count}</span>',
    // 글자가 없는 값(기호·숫자·공백)은 통과한다
    '<kbd>/</kbd>',
    '<span>{count} / 5</span>',
    '<span>3</span>',
    '<span> </span>',
    // 한글은 no-hardcoded-hangul이 보고해 여기서는 겹치지 않는다
    '<span>최근 링크</span>',
    '<span>URL 입력</span>',
    // 속성 값과 표현식 안 문자열은 보지 않는다
    '<button title="Close" />',
    '<span>{"Submit Link"}</span>',
  ],
  invalid: [
    { code: '<h1>Recent Links</h1>', errors: oneError },
    { code: '<Button>Submit Link</Button>', errors: oneError },
    { code: '<span>{count} items</span>', errors: oneError },
    { code: '<kbd>Ctrl</kbd>', errors: oneError },
    // 한글이 아닌 다른 언어도 막는다
    { code: '<span>日本語</span>', errors: oneError },
    {
      code: `<Button>
        Submit Link
      </Button>`,
      errors: oneError,
    },
  ],
});
