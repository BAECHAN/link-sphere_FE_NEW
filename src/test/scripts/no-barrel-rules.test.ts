import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: no-literal-jsx-text-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { noIndexFileRule, noValueReExportRule } from '../../../scripts/lib/no-barrel-rules.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { parser: tseslint.parser, parserOptions: { ecmaFeatures: { jsx: true } } },
});

ruleTester.run('no-index-file', noIndexFileRule, {
  valid: [
    { code: 'export const a = 1;', filename: 'src/shared/utils/date.util.ts' },
    { code: 'export const A = () => null;', filename: 'src/app/routes/AppRoutes.tsx' },
    // 이름에 index가 들어가도 파일 이름 자체가 index가 아니면 통과한다
    { code: 'export const a = 1;', filename: 'src/shared/utils/reindex.ts' },
    { code: 'export const a = 1;', filename: 'src/shared/index/search.ts' },
  ],
  invalid: [
    {
      code: 'export const a = 1;',
      filename: 'src/mocks/handlers/index.ts',
      errors: [{ messageId: 'indexFile' }],
    },
    {
      code: 'export const A = () => null;',
      filename: 'src/pages/post/index.tsx',
      errors: [{ messageId: 'indexFile' }],
    },
    // re-export가 없어도 파일 이름만으로 보고한다
    { code: '', filename: 'index.ts', errors: [{ messageId: 'indexFile' }] },
  ],
});

const oneError = [{ messageId: 'valueReExport' }];

ruleTester.run('no-value-reexport', noValueReExportRule, {
  valid: [
    // source가 없으면 자기 파일의 값을 내보내는 것이다
    'const a = 1; export { a };',
    'export const a = 1;',
    // 타입 전용은 런타임에 사라진다
    "export type { A } from './a';",
    "export { type A } from './a';",
    "export { type A, type B } from './a';",
    "export type * from './a';",
    "export type * as Types from './a';",
  ],
  invalid: [
    { code: "export * from './a';", errors: oneError },
    { code: "export * as a from './a';", errors: oneError },
    { code: "export { a } from './a';", errors: oneError },
    { code: "export { a as b } from './a';", errors: oneError },
    { code: "export { default } from './a';", errors: oneError },
    // 타입이 섞여도 값이 하나라도 있으면 모듈을 불러온다
    { code: "export { a, type B } from './a';", errors: oneError },
  ],
});
