// scope로 줄 서는 mutation이 mutationFn 첫 줄에서 인증 세대를 확인하는지 검사하는 ESLint 규칙
// (eslint.config.js의 custom-query-rules/scope-mutation-auth-epoch). 다른 커스텀 규칙처럼 eslint.config.js 안에 두지
// 않는 건 규칙 자체를 단위 테스트로 고정하기 위해서다 — 설정 파일 안에 있으면 테스트가 import할 수 없다
// (src/test/scripts/scope-mutation-auth-epoch-rule.test.ts, 같은 형태의 선례: prune-assets.js).
// dependency-cruiser가 이 디렉터리 안까지 따라가므로 아무것도 import하지 않는다.

const CHECK_NAME = 'assertMutationAuthEpochUnchanged';

/** 계산하지 않은 키의 이름(`scope`·`'scope'` 둘 다). 스프레드·계산된 키는 null */
function getKeyName(property) {
  if (property.type !== 'Property' || property.computed) {
    return null;
  }

  if (property.key.type === 'Identifier') {
    return property.key.name;
  }

  return property.key.type === 'Literal' ? property.key.value : null;
}

function findProperty(objectExpression, name) {
  return objectExpression.properties.find((property) => getKeyName(property) === name);
}

/**
 * 본문 첫 문장이 assertMutationAuthEpochUnchanged(<두 번째 매개변수>)인가. 인자 이름까지 보는 이유 - 시작 세대는
 * mutationFn이 받은 context 객체를 키로 기록돼 있어, 다른 값을 넘기면 기록이 없어 확인을 조용히 건너뛴다
 * (mutation-auth-epoch.ts).
 */
function startsWithAuthEpochCheck(fn) {
  const contextParam = fn.params[1];

  if (fn.body.type !== 'BlockStatement' || contextParam?.type !== 'Identifier') {
    return false;
  }

  const first = fn.body.body[0];
  const call = first?.type === 'ExpressionStatement' ? first.expression : null;

  return (
    call?.type === 'CallExpression' &&
    call.callee.type === 'Identifier' &&
    call.callee.name === CHECK_NAME &&
    call.arguments[0]?.type === 'Identifier' &&
    call.arguments[0].name === contextParam.name
  );
}

/**
 * useMutation 호출만이 아니라 scope와 mutationFn을 함께 가진 객체 리터럴을 모두 본다 - mutationOptions()·
 * setMutationDefaults로 옮겨도 빠져나가지 않게. 옵션을 변수·스프레드로 넘기면 보지 못한다(docs/FE-ARCHITECTURE.md §2).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const scopeMutationAuthEpochRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'scope로 줄 서는 mutation은 mutationFn 첫 줄에서 인증 세대를 확인해야 한다',
    },
    messages: {
      missingCheck:
        'scope로 줄 서는 mutation은 mutationFn 첫 줄에서 assertMutationAuthEpochUnchanged(context)를 불러야 합니다(context는 mutationFn의 두 번째 매개변수). 빠뜨리면 줄에서 기다리는 사이 계정이 바뀌었을 때 요청이 새 계정으로 나갑니다. (docs/FE-ARCHITECTURE.md §11 "같은 대상의 연속 mutation" 6번)',
      notInlineFunction:
        'scope mutation의 mutationFn은 인라인 함수로 써 주세요 - 첫 줄에서 assertMutationAuthEpochUnchanged(context)를 부르는지 검사할 수 있어야 합니다. (docs/FE-ARCHITECTURE.md §11 "같은 대상의 연속 mutation" 6번)',
    },
  },
  create(context) {
    return {
      ObjectExpression(node) {
        const mutationFn = findProperty(node, 'mutationFn');

        if (!mutationFn || !findProperty(node, 'scope')) {
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
