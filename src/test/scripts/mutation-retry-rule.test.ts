import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { describe, expect, it } from 'vitest';
// vitest는 src/만 테스트하므로 scripts/의 린트 규칙을 여기서 검증한다(선례: scope-mutation-auth-epoch-rule.test.ts)
// eslint-disable-next-line custom-import/no-relative-import-except-styles -- @/ 별칭은 src/만 가리켜 scripts/를 가리킬 수 없다
import { mutationRetryRule } from '../../../scripts/lib/mutation-retry-rule.js';

// RuleTester가 케이스마다 vitest의 describe/it으로 테스트를 만든다
RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({ languageOptions: { parser: tseslint.parser } });

// mutation이 있는 실제 파일 전부. vitest는 레포(워크트리) 루트를 process.cwd()로 실행한다(storage-keys.test.ts)
const MUTATION_FILES = [
  'src/entities/account/api/account.queries.ts',
  'src/entities/auth/api/auth.queries.ts',
  'src/entities/bookmark/folder/api/bookmark-folder.queries.ts',
  'src/entities/comment/api/comment.queries.ts',
  'src/entities/interaction/api/interaction.queries.ts',
  'src/entities/post/api/post.queries.ts',
];
// post.queries.ts에는 조회용 retry: false도 있어 지운 줄 수가 아니라 mutationFn 수만큼 실패를 기대한다
const RETRY_LINE = /^[ \t]*retry: (?:false|shouldRetryIdempotentMutation),\n/gm;
const MUTATION_FN = /^[ \t]*mutationFn\b/gm;
const RESEND_LINE = /^[ \t]*retry: shouldRetryIdempotentMutation,\n/gm;
const CHECK_LINE = /^[ \t]*assertMutationAuthEpochUnchanged\(\w+\);\n/gm;

// 줄을 지운 사본이 지운 만큼 실패해야 규칙이 실제 코드 모양을 보고 있다(헛통과가 아니다)는 게 증명된다
const realFiles = MUTATION_FILES.map((file) => {
  const code = readFileSync(join(process.cwd(), file), 'utf-8');

  return {
    file,
    code,
    withoutRetry: code.replace(RETRY_LINE, ''),
    mutationCount: code.match(MUTATION_FN)?.length ?? 0,
    withoutCheck: code.replace(CHECK_LINE, ''),
    resendCount: code.match(RESEND_LINE)?.length ?? 0,
  };
});
const filesWithResend = realFiles.filter(({ resendCount }) => resendCount > 0);

describe('실제 mutation 파일', () => {
  it.each(realFiles)('$file에서 mutationFn을 찾았다', ({ mutationCount }) => {
    expect(mutationCount).toBeGreaterThan(0);
  });

  it('재전송을 선언한 파일이 있다', () => {
    expect(filesWithResend.length).toBeGreaterThan(0);
  });
});

ruleTester.run('custom-query-rules/mutation-retry-declared', mutationRetryRule, {
  valid: [
    {
      name: 'mutationFn이 없는 객체는 검사하지 않는다',
      code: `useQuery({ queryKey: ['post'], queryFn: api.fetch, retry: 3 });`,
    },
    {
      name: '다시 보내지 않는다고 선언하면 계정 확인은 보지 않는다',
      code: `useMutation({ retry: false, mutationFn: (payload: Login) => api.login(payload) });`,
    },
    {
      name: '재전송 선언 + 화살표 함수 첫 줄 확인',
      code: `
        useMutation({
          retry: shouldRetryIdempotentMutation,
          mutationFn: (next: boolean, context) => {
            assertMutationAuthEpochUnchanged(context);

            return api.like(next);
          },
        });
      `,
    },
    {
      name: '재전송 선언 + async 함수 표현식 첫 줄 확인',
      code: `
        useMutation({
          retry: shouldRetryIdempotentMutation,
          mutationFn: async function (id: string, ctx) {
            assertMutationAuthEpochUnchanged(ctx);
            await api.remove(id);
          },
        });
      `,
    },
    {
      name: 'mutationFn이 함수 참조여도 다시 보내지 않으면 된다',
      code: `useMutation({ retry: false, mutationFn: sendLogin });`,
    },
    ...realFiles.map(({ file, code }) => ({ name: `실제 파일 원본: ${file}`, code })),
  ],
  invalid: [
    {
      name: 'retry를 선언하지 않았다',
      code: `useMutation({ mutationFn: (payload: Login) => api.login(payload) });`,
      errors: [{ messageId: 'missingRetry' }],
    },
    {
      name: 'mutationOptions로 옮겨도 잡는다',
      code: `mutationOptions({ mutationKey: ['login'], mutationFn: sendLogin });`,
      errors: [{ messageId: 'missingRetry' }],
    },
    {
      name: '횟수를 직접 적었다',
      code: `useMutation({ retry: 3, mutationFn: sendLogin });`,
      errors: [{ messageId: 'invalidRetry' }],
    },
    {
      name: 'true로 켰다',
      code: `useMutation({ retry: true, mutationFn: sendLogin });`,
      errors: [{ messageId: 'invalidRetry' }],
    },
    {
      name: '다른 정책 함수를 썼다',
      code: `useMutation({ retry: shouldRetryQuery, mutationFn: sendLogin });`,
      errors: [{ messageId: 'invalidRetry' }],
    },
    {
      name: '재전송인데 mutationFn이 함수 참조라 검사할 수 없다',
      code: `useMutation({ retry: shouldRetryIdempotentMutation, mutationFn: sendLike });`,
      errors: [{ messageId: 'notInlineFunction' }],
    },
    {
      name: '재전송인데 계정을 확인하지 않는다',
      code: `
        useMutation({
          retry: shouldRetryIdempotentMutation,
          mutationFn: (next: boolean, context) => {
            return api.like(next, context);
          },
        });
      `,
      errors: [{ messageId: 'missingCheck' }],
    },
    {
      name: '재전송인데 요청을 보낸 뒤에 확인한다',
      code: `
        useMutation({
          retry: shouldRetryIdempotentMutation,
          mutationFn: async (next: boolean, context) => {
            await api.like(next);
            assertMutationAuthEpochUnchanged(context);
          },
        });
      `,
      errors: [{ messageId: 'missingCheck' }],
    },
    {
      name: '재전송인데 식 본문이라 확인이 없다',
      code: `useMutation({ retry: shouldRetryIdempotentMutation, mutationFn: (next: boolean, context) => api.like(next) });`,
      errors: [{ messageId: 'missingCheck' }],
    },
    ...realFiles.map(({ file, withoutRetry, mutationCount }) => ({
      name: `실제 파일에서 retry 줄을 지운 사본: ${file}`,
      code: withoutRetry,
      errors: Array.from({ length: mutationCount }, () => ({ messageId: 'missingRetry' })),
    })),
    ...filesWithResend.map(({ file, withoutCheck, resendCount }) => ({
      name: `실제 파일에서 계정 확인 줄을 지운 사본: ${file}`,
      code: withoutCheck,
      errors: Array.from({ length: resendCount }, () => ({ messageId: 'missingCheck' })),
    })),
  ],
});
