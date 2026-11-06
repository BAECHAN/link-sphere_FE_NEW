// 화면에 보이는 글자를 JSX에 직접 적지 못하게 막는 ESLint 규칙(eslint.config.js의
// custom-i18n/no-literal-jsx-text). no-hardcoded-hangul은 한글만 봐서 Recent Links·Submit Link가
// 2026-01-25 첫 구현부터 통과해 있었다(2026-11-06 발견). no-literal-a11y-name-rule.js와 같은 이유로
// 설정 파일 밖에 두고 단위 테스트로 고정한다(src/test/scripts/no-literal-jsx-text-rule.test.ts).
// 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.

const HAS_LETTER = /\p{L}/u;
// 한글이 섞인 글자는 no-hardcoded-hangul이 보고한다(같은 정규식)
const HAS_HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;

/**
 * 요소 사이에 직접 적은 글자를 본다. 속성 값과 {'...'} 안 문자열, texts.ts 안의 값은 보지 않는다.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const noLiteralJsxTextRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '화면에 보이는 글자를 JSX에 직접 작성 금지(언어 무관)',
    },
    messages: {
      literalText:
        '화면에 보이는 글자는 언어와 상관없이 직접 쓸 수 없습니다. src/shared/config/texts.ts의 TEXTS.*에 키를 추가한 뒤 참조하세요.',
    },
  },
  create(context) {
    return {
      JSXText(node) {
        if (HAS_LETTER.test(node.value) && !HAS_HANGUL.test(node.value)) {
          context.report({ node, messageId: 'literalText' });
        }
      },
    };
  },
};
