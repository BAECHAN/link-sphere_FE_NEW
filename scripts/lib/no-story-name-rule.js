// 스토리 이름을 export 이름 하나로 정하는 ESLint 규칙(eslint.config.js의 custom-storybook/no-story-name).
// 공식 eslint-plugin-storybook의 no-redundant-story-name은 export 이름과 같은 name만 잡아,
// '비제어형 — click으로 열림'처럼 설명을 붙인 name은 통과한다(2026-11-18 발견, docs/FE-ARCHITECTURE.md §18).
// no-literal-jsx-text-rule.js와 같은 이유로 설정 파일 밖에 두고 단위 테스트로 고정한다
// (src/test/scripts/no-story-name-rule.test.ts). 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.

function unwrapExpression(node) {
  let current = node;

  while (
    current &&
    (current.type === 'TSSatisfiesExpression' || current.type === 'TSAsExpression')
  ) {
    current = current.expression;
  }

  return current;
}

function isNameKey(property) {
  if (property.type !== 'Property' || property.computed) {
    return false;
  }

  return property.key.type === 'Identifier'
    ? property.key.name === 'name'
    : property.key.value === 'name';
}

/**
 * 내보낸 스토리 객체(`export const X = {...}`)의 최상위 `name` 속성을 본다. `args.name`처럼 안쪽 객체와
 * default export(meta)는 보지 않는다. 자동 수정은 두지 않는다(title-matches-path와 같은 방침).
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const noStoryNameRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '스토리 이름은 export 이름으로만 정한다(name 속성 금지)',
    },
    messages: {
      storyName:
        '스토리 이름은 export 이름에서 나옵니다. name을 지우고 export 이름을 바꿔주세요. (docs/FE-ARCHITECTURE.md §18)',
    },
  },
  create(context) {
    return {
      'ExportNamedDeclaration > VariableDeclaration > VariableDeclarator'(node) {
        const story = unwrapExpression(node.init);

        if (story?.type !== 'ObjectExpression') {
          return;
        }

        for (const property of story.properties) {
          if (isNameKey(property)) {
            context.report({ node: property, messageId: 'storyName' });
          }
        }
      },
    };
  },
};
