import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: prune-assets.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { scopeMutationAuthEpochRule } from '../../../scripts/lib/scope-mutation-auth-epoch-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

// scope mutation이 있는 실제 파일. vitest는 레포(워크트리) 루트를 process.cwd()로 실행한다(storage-keys.test.ts)
const SCOPE_MUTATION_FILES = [
  'src/entities/interaction/api/interaction.queries.ts',
  'src/entities/bookmark/folder/api/bookmark-folder.queries.ts',
];
const CHECK_LINE = /^[ \t]*assertMutationAuthEpochUnchanged\(\w+\);\n/gm;

// 확인 줄을 지운 사본이 지운 수만큼 실패해야 규칙이 실제 코드 모양을 보고 있다(헛통과가 아니다)는 게 증명된다
const realFiles = SCOPE_MUTATION_FILES.map((file) => {
  const code = readFileSync(join(process.cwd(), file), 'utf-8');

  return {
    file,
    code,
    withoutCheck: code.replace(CHECK_LINE, ''),
    removedCount: code.match(CHECK_LINE)?.length ?? 0,
  };
});

describe('실제 scope mutation 파일', () => {
  it.each(realFiles)('$file에서 지울 확인 줄을 찾았다', ({ removedCount }) => {
    expect(removedCount).toBeGreaterThan(0);
  });
});

ruleTester.run('custom-query-rules/scope-mutation-auth-epoch', scopeMutationAuthEpochRule, {
  valid: [
    {
      name: 'scope가 없으면 검사하지 않는다',
      code: `useMutation({ mutationFn: (id: string) => api.remove(id) });`,
    },
    {
      name: '화살표 함수 첫 줄에서 두 번째 매개변수로 확인한다',
      code: `
        useMutation({
          scope: { id: 'like' },
          mutationFn: (next: boolean, context) => {
            assertMutationAuthEpochUnchanged(context);

            return api.like(next);
          },
        });
      `,
    },
    {
      name: '메서드 축약',
      code: `
        useMutation({
          scope: { id: 'bookmark' },
          mutationFn(target: boolean, context) {
            assertMutationAuthEpochUnchanged(context);

            return api.bookmark(target);
          },
        });
      `,
    },
    {
      name: '매개변수 이름이 context가 아니어도 두 번째 매개변수면 된다',
      code: `
        useMutation({
          scope: { id: 'clear' },
          mutationFn: (_variables: void, ctx) => {
            assertMutationAuthEpochUnchanged(ctx);

            return api.clear();
          },
        });
      `,
    },
    {
      name: 'async function 표현식',
      code: `
        useMutation({
          scope: { id: 'remove' },
          mutationFn: async function (id: string, context) {
            assertMutationAuthEpochUnchanged(context);
            await api.remove(id);
          },
        });
      `,
    },
    ...realFiles.map(({ file, code }) => ({ name: `실제 파일 원본: ${file}`, code })),
  ],
  invalid: [
    {
      name: '확인을 부르지 않는다',
      code: `
        useMutation({
          scope: { id: 'like' },
          mutationFn: (next: boolean, context) => {
            return api.like(next, context);
          },
        });
      `,
      errors: [{ messageId: 'missingCheck', line: 4 }],
    },
    {
      name: '요청을 보낸 뒤에 확인한다',
      code: `
        useMutation({
          scope: { id: 'like' },
          mutationFn: async (next: boolean, context) => {
            await api.like(next);
            assertMutationAuthEpochUnchanged(context);
          },
        });
      `,
      errors: [{ messageId: 'missingCheck' }],
    },
    {
      name: 'mutationFn이 받은 context가 아닌 값으로 확인한다',
      code: `
        useMutation({
          scope: { id: 'like' },
          mutationFn: (next: boolean, context) => {
            assertMutationAuthEpochUnchanged(otherContext);

            return api.like(next, context);
          },
        });
      `,
      errors: [{ messageId: 'missingCheck' }],
    },
    {
      name: 'context 매개변수가 없다(바깥 변수로 확인)',
      code: `
        useMutation({
          scope: { id: 'like' },
          mutationFn: (next: boolean) => {
            assertMutationAuthEpochUnchanged(context);

            return api.like(next);
          },
        });
      `,
      errors: [{ messageId: 'missingCheck' }],
    },
    {
      name: '식 본문 화살표 함수',
      code: `useMutation({ scope: { id: 'like' }, mutationFn: (next: boolean, context) => api.like(next) });`,
      errors: [{ messageId: 'missingCheck' }],
    },
    {
      name: 'mutationFn이 함수 참조라 검사할 수 없다',
      code: `useMutation({ scope: { id: 'like' }, mutationFn: sendLike });`,
      errors: [{ messageId: 'notInlineFunction' }],
    },
    {
      name: 'mutationFn이 축약 속성이라 검사할 수 없다',
      code: `useMutation({ scope, mutationFn });`,
      errors: [{ messageId: 'notInlineFunction' }],
    },
    {
      name: 'useMutation이 아닌 mutationOptions로 옮겨도 잡는다',
      code: `
        mutationOptions({
          mutationKey: ['like'],
          scope: { id: 'like' },
          mutationFn: (next: boolean, context) => {
            return api.like(next, context);
          },
        });
      `,
      errors: [{ messageId: 'missingCheck' }],
    },
    {
      name: '문자열 키로 쓴 scope',
      code: `
        useMutation({
          'scope': { id: 'like' },
          mutationFn: (next: boolean, context) => {
            return api.like(next, context);
          },
        });
      `,
      errors: [{ messageId: 'missingCheck' }],
    },
    ...realFiles.map(({ file, withoutCheck, removedCount }) => ({
      name: `실제 파일에서 확인 줄을 지운 사본: ${file}`,
      code: withoutCheck,
      errors: Array.from({ length: removedCount }, () => ({ messageId: 'missingCheck' })),
    })),
  ],
});
