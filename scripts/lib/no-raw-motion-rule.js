// 시간·곡선을 토큰 클래스로만 쓰게 하는 ESLint 규칙(eslint.config.js의 custom-tailwind/no-raw-motion).
// 시간은 duration-d4처럼, 곡선은 ease-easing처럼 쓴다(목록은 docs/DESIGN-TOKENS.md "시간"·"가속 곡선").
// 숫자, Tailwind 기본 이름, 대괄호·괄호 값을 막는다(2026-11-26 게이트 2, docs/DESIGN-SYSTEM.md §5 "시간과 곡선").
// delay는 토큰이 없어 보지 않는다. 대괄호 속성으로 적은 시간(transition-duration을 직접 적는 꼴)도 보지 않는다.
// ui-boundary-rule.js와 같은 이유로 설정 파일 밖에 두고 단위 테스트로 고정한다
// (src/test/scripts/no-raw-motion-rule.test.ts). 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.
// (주석에 막는 클래스 이름을 그대로 적지 않는다 - Tailwind 스캐너가 이 파일도 훑어 쓰지 않는 유틸리티를 만든다.)

// 앞에 글자나 하이픈이 오면 다른 이름의 일부다(--transition-duration-d4 같은 변수 이름)
const BEFORE = '(?<![\\w-])';
// 대괄호 값과 괄호(변수) 값
const ARBITRARY = '\\[[^\\]]*\\]|\\([^)]*\\)';
const RAW_DURATION = new RegExp(`${BEFORE}duration-(?:\\d[\\w.]*|initial(?![\\w-])|${ARBITRARY})`);
const RAW_EASE = new RegExp(
  `${BEFORE}ease-(?:(?:in-out|in|out|linear|initial)(?![\\w-])|${ARBITRARY})`
);

/** @type {import('eslint').Rule.RuleModule} */
export const noRawMotionRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '숫자·기본 이름·대괄호 값의 시간·곡선 클래스 금지, 토큰 클래스 사용',
    },
    messages: {
      rawMotion:
        '"{{value}}" 대신 시간·곡선 토큰 클래스(duration-d4, ease-easing 등. 목록은 docs/DESIGN-TOKENS.md "시간"·"가속 곡선")를 쓰세요. 필요한 값이 없으면 packages/ui/tokens/에 토큰을 먼저 더합니다.',
    },
  },
  create(context) {
    function report(node, value) {
      if (typeof value !== 'string') {
        return;
      }

      const match = RAW_DURATION.exec(value) ?? RAW_EASE.exec(value);

      if (match) {
        context.report({ node, messageId: 'rawMotion', data: { value: match[0] } });
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
