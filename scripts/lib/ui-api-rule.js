// 공용 UI 부품의 API 규칙을 지키게 하는 ESLint 규칙 2개(eslint.config.js의 custom-design-system/cva-variant-keys,
// custom-design-system/classname-last). 규칙과 정한 이유는 docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4에 있다.
// ui-boundary-rule.js와 같은 이유로 설정 파일 밖에 두고 단위 테스트로 고정한다
// (src/test/scripts/ui-api-rule.test.ts). 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.

/** cva `variants`에 둘 수 있는 축 이름. 늘리기 전에 docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4를 먼저 고친다 */
const ALLOWED_VARIANT_KEYS = ['variant', 'size', 'tone'];

/** 쓰는 쪽이 넘긴 클래스를 받는 속성 이름 - cva는 `class`도 같은 뜻으로 받는다 */
const CLASS_OPTION_KEYS = ['className', 'class'];

/** 객체 속성의 이름을 돌려준다. 계산된 키처럼 이름을 알 수 없으면 undefined */
function staticKeyName(property) {
  if (property.type !== 'Property') {
    return undefined;
  }

  if (property.key.type === 'Literal') {
    return String(property.key.value);
  }

  if (property.key.type === 'Identifier' && !property.computed) {
    return property.key.name;
  }

  return undefined;
}

function isCvaCall(node) {
  return node.callee.type === 'Identifier' && node.callee.name === 'cva';
}

/**
 * cva `variants`의 축 이름을 허용 목록으로 막는다. 고르는 축이 하나면 `variant`라서, `tone`은 `variant`와 함께 있을 때만 통과한다.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const cvaVariantKeysRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '공용 UI 부품의 cva variants 축 이름을 variant·size·tone으로 제한',
    },
    messages: {
      key: "cva variants의 축 이름 '{{key}}'는 쓸 수 없습니다. 종류는 variant, 크기는 size, 모양과 따로 고르는 뜻은 tone입니다. (근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4)",
      toneAlone:
        'tone은 variant와 함께 있을 때만 씁니다. 고르는 축이 하나면 variant로 적습니다. (근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4)',
    },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isCvaCall(node)) {
          return;
        }

        const config = node.arguments[1];

        if (config?.type !== 'ObjectExpression') {
          return;
        }

        const variants = config.properties.find(
          (property) => staticKeyName(property) === 'variants'
        );

        if (variants?.value.type !== 'ObjectExpression') {
          return;
        }

        const axes = variants.value.properties
          .map((property) => ({ node: property, name: staticKeyName(property) }))
          .filter((axis) => axis.name !== undefined);

        for (const axis of axes) {
          if (!ALLOWED_VARIANT_KEYS.includes(axis.name)) {
            context.report({ node: axis.node.key, messageId: 'key', data: { key: axis.name } });
          }
        }

        const tone = axes.find((axis) => axis.name === 'tone');
        const hasVariant = axes.some((axis) => axis.name === 'variant');

        if (tone && !hasVariant) {
          context.report({ node: tone.node.key, messageId: 'toneAlone' });
        }
      },
    };
  },
};

/**
 * 쓰는 쪽이 넘긴 `className`이 부품의 클래스를 이기게, `cn()`의 맨 뒤 인자로만 받게 한다. 같은 파일에서 cva로 만든
 * 함수에 `className`을 넘기는 형태도 막아 합치는 자리를 하나로 둔다.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const classNameLastRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '공용 UI 부품에서 className은 cn()의 맨 뒤 인자로만 합친다',
    },
    messages: {
      notLast:
        'cn()에서 className은 맨 뒤 인자여야 합니다. 쓰는 쪽이 넘긴 클래스가 부품의 클래스를 이깁니다. (근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4)',
      insideCva:
        'cva로 만든 함수({{name}})에는 {{key}} 값을 넘기지 않습니다. cn({{name}}(...), className)으로 합칩니다. (근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §1.4)',
    },
  },
  create(context) {
    const cvaFunctionNames = new Set();
    // cva 선언이 호출보다 아래에 있을 수도 있어, 호출은 모아 두고 파일을 다 본 뒤에 판정한다
    const identifierCalls = [];

    return {
      VariableDeclarator(node) {
        const isCvaResult =
          node.id.type === 'Identifier' &&
          node.init?.type === 'CallExpression' &&
          isCvaCall(node.init);

        if (isCvaResult) {
          cvaFunctionNames.add(node.id.name);
        }
      },
      CallExpression(node) {
        if (node.callee.type !== 'Identifier') {
          return;
        }

        if (node.callee.name !== 'cn') {
          identifierCalls.push(node);
          return;
        }

        const lastIndex = node.arguments.length - 1;

        node.arguments.forEach((argument, index) => {
          const isClassName = argument.type === 'Identifier' && argument.name === 'className';

          if (isClassName && index !== lastIndex) {
            context.report({ node: argument, messageId: 'notLast' });
          }
        });
      },
      'Program:exit'() {
        for (const node of identifierCalls) {
          const name = node.callee.name;
          const [options] = node.arguments;

          if (!cvaFunctionNames.has(name) || options?.type !== 'ObjectExpression') {
            continue;
          }

          for (const property of options.properties) {
            const key = staticKeyName(property);

            if (CLASS_OPTION_KEYS.includes(key)) {
              context.report({ node: property, messageId: 'insideCva', data: { name, key } });
            }
          }
        }
      },
    };
  },
};
