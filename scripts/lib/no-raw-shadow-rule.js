// 그림자를 토큰 클래스로만 쓰게 하는 ESLint 규칙(eslint.config.js의 custom-tailwind/no-raw-shadow).
// 그림자는 shadow-s1~shadow-s4로 쓰고, 없앨 때는 shadow-none을 쓴다(목록은 docs/DESIGN-TOKENS.md "그림자").
// Tailwind 기본 이름(이름 없는 그림자 포함)과 대괄호·괄호 값을 막는다(2026-11-26 게이트 2, docs/DESIGN-SYSTEM.md §5 "그림자").
// 문자열 전체가 shadow 한 낱말이면 토큰 묶음 이름 같은 낱말이라 보지 않는다.
// 그림자 색 클래스, drop-shadow·inset-shadow·text-shadow는 보지 않는다.
// no-raw-motion-rule.js와 같은 이유로 설정 파일 밖에 두고 단위 테스트로 고정한다(src/test/scripts/no-raw-shadow-rule.test.ts).
// 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.
// (주석에 막는 클래스 이름을 그대로 적지 않는다 - Tailwind 스캐너가 이 파일도 훑어 쓰지 않는 유틸리티를 만든다.)

// 앞에 글자나 하이픈이 오면 다른 이름의 일부다(drop-shadow-*, --shadow-s1 같은 변수 이름)
const BEFORE = '(?<![\\w-])';
// 대괄호 값과 괄호(변수) 값
const ARBITRARY = '\\[[^\\]]*\\]|\\([^)]*\\)';
// Tailwind 4.3.5 theme.css의 그림자 이름(inner는 4.0부터 쓰지 않는 이름이지만 아직 동작한다)
const DEFAULT_NAMES = '2xs|xs|sm|md|lg|xl|2xl|inner';
const RAW_SHADOW = new RegExp(`${BEFORE}shadow-(?:(?:${DEFAULT_NAMES})(?![\\w-])|${ARBITRARY})`);
// 이름 없는 그림자. Tailwind 호환 테마의 기본값(boxShadow.DEFAULT)을 낸다
const BARE_SHADOW = new RegExp(`${BEFORE}shadow(?![\\w-])`);
const BARE_WORD = 'shadow';

/** @type {import('eslint').Rule.RuleModule} */
export const noRawShadowRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'Tailwind 기본 이름·대괄호 값의 그림자 클래스 금지, 토큰 클래스 사용',
    },
    messages: {
      rawShadow:
        '"{{value}}" 대신 그림자 토큰 클래스(shadow-s1~shadow-s4. 목록은 docs/DESIGN-TOKENS.md "그림자")를 쓰세요. 그림자를 없애려면 shadow-none을 씁니다. 필요한 값이 없으면 packages/ui/tokens/에 토큰을 먼저 더합니다.',
    },
  },
  create(context) {
    function report(node, value) {
      if (typeof value !== 'string') {
        return;
      }

      const match =
        RAW_SHADOW.exec(value) ?? (value === BARE_WORD ? null : BARE_SHADOW.exec(value));

      if (match) {
        context.report({ node, messageId: 'rawShadow', data: { value: match[0] } });
      }
    }

    return {
      Literal(node) {
        report(node, node.value);
      },
      TemplateLiteral(node) {
        for (const quasi of node.quasis) {
          report(quasi, quasi.value.raw);
        }
      },
    };
  },
};
