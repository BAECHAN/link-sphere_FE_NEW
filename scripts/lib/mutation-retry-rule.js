// mutation마다 응답을 못 받았을 때 다시 보낼지 선언했는지 검사하는 ESLint 규칙(eslint.config.js의
// custom-query-rules/mutation-retry-declared). scope-mutation-auth-epoch-rule.js와 같은 이유로 설정 파일 밖에 두고
// 단위 테스트로 고정한다(src/test/scripts/mutation-retry-rule.test.ts). 패키지는 import하지 않는다 - dependency-cruiser가
// 이 디렉터리 안까지 따라간다.

import { findProperty, startsWithAuthEpochCheck } from './scope-mutation-auth-epoch-rule.js';

const POLICY_NAME = 'shouldRetryIdempotentMutation';

/**
 * useMutation 호출만이 아니라 mutationFn을 가진 객체 리터럴을 모두 본다 - scope-mutation-auth-epoch와 같은 이유로
 * mutationOptions()·setMutationDefaults로 옮겨도 빠져나가지 않게. 옵션을 변수·스프레드로 넘기면 보지 못한다.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const mutationRetryRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'mutation은 응답을 못 받았을 때 다시 보낼지 retry로 선언해야 한다',
    },
    messages: {
      missingRetry:
        'mutation은 retry를 선언해야 합니다 - 다시 보내도 결과가 같으면 shouldRetryIdempotentMutation, 아니면 false와 이유 주석. 빠뜨리면 응답을 못 받았을 때 저장됐을 수 있는데 실패로 보입니다. (docs/FE-ARCHITECTURE.md §28)',
      invalidRetry:
        'mutation의 retry는 false 또는 shouldRetryIdempotentMutation만 쓸 수 있습니다 - 재시도 정책을 retry-policy.ts 한곳에 둡니다. (docs/FE-ARCHITECTURE.md §28)',
      notInlineFunction:
        '다시 보내는 mutation의 mutationFn은 인라인 함수로 써 주세요 - 첫 줄에서 assertMutationAuthEpochUnchanged(context)를 부르는지 검사할 수 있어야 합니다. (docs/FE-ARCHITECTURE.md §28)',
      missingCheck:
        '다시 보내는 mutation은 mutationFn 첫 줄에서 assertMutationAuthEpochUnchanged(context)를 불러야 합니다(context는 mutationFn의 두 번째 매개변수). 빠뜨리면 그사이 계정이 바뀌었을 때 요청이 새 계정으로 나갑니다. (docs/FE-ARCHITECTURE.md §28)',
    },
  },
  create(context) {
    return {
      ObjectExpression(node) {
        const mutationFn = findProperty(node, 'mutationFn');

        if (!mutationFn) {
          return;
        }

        const retry = findProperty(node, 'retry');

        if (!retry) {
          context.report({ node: mutationFn, messageId: 'missingRetry' });
          return;
        }

        const isOff = retry.value.type === 'Literal' && retry.value.value === false;
        const isResend = retry.value.type === 'Identifier' && retry.value.name === POLICY_NAME;

        if (!isOff && !isResend) {
          context.report({ node: retry, messageId: 'invalidRetry' });
          return;
        }

        if (isOff) {
          return;
        }

        const fn = mutationFn.value;

        if (fn.type !== 'ArrowFunctionExpression' && fn.type !== 'FunctionExpression') {
          context.report({ node: mutationFn, messageId: 'notInlineFunction' });
          return;
        }

        if (!startsWithAuthEpochCheck(fn)) {
          context.report({ node: mutationFn, messageId: 'missingCheck' });
        }
      },
    };
  },
};
