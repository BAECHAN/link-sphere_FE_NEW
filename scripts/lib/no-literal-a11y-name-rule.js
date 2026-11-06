// 화면 읽기 프로그램이 읽는 문구를 코드에 직접 적지 못하게 막는 ESLint 규칙(eslint.config.js의
// custom-i18n/no-literal-a11y-name). no-hardcoded-hangul은 한글만 봐서 영어 문구가 그대로 통과했다(2026-11-06 8곳 발견).
// mutation-retry-rule.js와 같은 이유로 설정 파일 밖에 두고 단위 테스트로 고정한다
// (src/test/scripts/no-literal-a11y-name-rule.test.ts). 패키지는 import하지 않는다 - dependency-cruiser가
// 이 디렉터리 안까지 따라간다.

// empty:sr-only·max-md:sr-only는 어떤 때는 글자가 화면에 보이므로 해당하지 않는다
const SR_ONLY_TOKEN = /(^|\s)sr-only(\s|$)/;
const HAS_LETTER = /\p{L}/u;

/** className 값(문자열, cn() 인자, cn({ 'sr-only': x }) 객체, 조건식, 템플릿)에 sr-only가 있는지 본다 */
function hasSrOnlyToken(node) {
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' && SR_ONLY_TOKEN.test(node.value);
    case 'TemplateLiteral':
      return node.quasis.some((quasi) => SR_ONLY_TOKEN.test(quasi.value.raw));
    case 'ConditionalExpression':
      return hasSrOnlyToken(node.consequent) || hasSrOnlyToken(node.alternate);
    case 'LogicalExpression':
      return hasSrOnlyToken(node.left) || hasSrOnlyToken(node.right);
    case 'CallExpression':
      return node.arguments.some(hasSrOnlyToken);
    case 'ObjectExpression':
      return node.properties.some(
        (property) => property.type === 'Property' && hasSrOnlyToken(property.key)
      );
    case 'JSXExpressionContainer':
      return hasSrOnlyToken(node.expression);
    default:
      return false;
  }
}

/** 이름이 되는 값에서 글자를 직접 적은 노드를 모은다. 조건식의 조건은 이름이 아니라 보지 않고, 중첩 요소의 글자는 함께 읽히므로 따라 들어간다 */
function findLiteralTexts(node) {
  switch (node.type) {
    case 'Literal':
      return typeof node.value === 'string' && HAS_LETTER.test(node.value) ? [node] : [];
    case 'JSXText':
      return HAS_LETTER.test(node.value) ? [node] : [];
    case 'TemplateLiteral':
      return [
        ...node.quasis.filter((quasi) => HAS_LETTER.test(quasi.value.raw)),
        ...node.expressions.flatMap(findLiteralTexts),
      ];
    case 'ConditionalExpression':
      return [...findLiteralTexts(node.consequent), ...findLiteralTexts(node.alternate)];
    case 'LogicalExpression':
      return [...findLiteralTexts(node.left), ...findLiteralTexts(node.right)];
    case 'JSXExpressionContainer':
      return findLiteralTexts(node.expression);
    case 'JSXElement':
    case 'JSXFragment':
      return node.children.flatMap(findLiteralTexts);
    default:
      return [];
  }
}

/**
 * aria-label 값과 sr-only 요소 안 글자를 본다. alt·title은 보지 않는다.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const noLiteralA11yNameRule = {
  meta: {
    type: 'problem',
    docs: {
      description:
        '화면 읽기 프로그램이 읽는 문구(aria-label, sr-only 요소 안 글자) 직접 작성 금지',
    },
    messages: {
      literalName:
        '화면 읽기 프로그램이 읽는 문구는 언어와 상관없이 직접 쓸 수 없습니다. src/shared/config/texts.ts의 TEXTS.*에 키를 추가한 뒤 참조하세요.',
    },
  },
  create(context) {
    function reportAll(nodes) {
      for (const node of nodes) {
        context.report({ node, messageId: 'literalName' });
      }
    }

    return {
      JSXAttribute(node) {
        if (node.name.name === 'aria-label' && node.value) {
          reportAll(findLiteralTexts(node.value));
        }
      },
      JSXElement(node) {
        const className = node.openingElement.attributes.find(
          (attribute) => attribute.type === 'JSXAttribute' && attribute.name.name === 'className'
        );

        if (!className?.value || !hasSrOnlyToken(className.value)) {
          return;
        }

        reportAll(node.children.flatMap(findLiteralTexts));
      },
    };
  },
};
