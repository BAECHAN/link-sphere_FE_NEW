// 검정·흰색·명명 팔레트(gray-500 등) 리터럴 색 클래스를 막는 ESLint 규칙(eslint.config.js의 custom-tailwind/no-raw-color).
// 이유: CLAUDE.md가 "ESLint 미강제라 회귀해도 안 잡힌다"고 명시해온 유일한 색상 규칙이었다(2026-09-09 감사에서 raw
// gray/zinc 잔존을 발견해 수동으로만 고침). 검정·흰색은 명명 팔레트가 아니라 grep 규칙에도 안 걸렸는데, 실제로
// ImageViewer.tsx 등 12곳에 그런 리터럴이 남아 있었다(2026-09-13 조사). 딤 토큰을 둔 뒤 코드로 강제한다.
// 2026-11-27 eslint.config.js 안에서 이 파일로 옮겼다. 의미 색 이름(2026-11-27 게이트 3)의 가운데 마디가 팔레트 이름과
// 같아(neutral) 긴 이름의 조각을 팔레트 클래스로 잘못 잡던 것을 고치고, 단위 테스트로 고정한다
// (src/test/scripts/no-raw-color-rule.test.ts).
// 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.
// (주석에 막는 클래스 이름을 그대로 적지 않는다 - Tailwind 스캐너가 이 파일도 훑어 쓰지 않는 유틸리티를 만든다.)

// 앞에 글자나 하이픈이 오면 더 긴 이름의 일부다(의미 색 클래스의 가운데 마디, --palette 같은 변수 이름)
const BEFORE = '(?<![\\w-])';
// 하이픈으로 이어진 유틸리티(안쪽 그림자·안쪽 링·드롭 그림자·글자 그림자)는 통째로 적는다. 위 경계 때문에 뒤 마디만으로는 잡히지 않는다
const UTILITIES =
  'inset-shadow|inset-ring|drop-shadow|text-shadow|bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|accent|caret|placeholder';
const PALETTE_NAMES =
  'black|white|slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
const SHADES = '50|100|200|300|400|500|600|700|800|900|950';
const RAW_COLOR = new RegExp(
  `${BEFORE}(?:${UTILITIES})-(?:${PALETTE_NAMES})(?:-(?:${SHADES}))?\\b`
);

/** @type {import('eslint').Rule.RuleModule} */
export const noRawColorRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'black/white/명명 팔레트 리터럴 색상 클래스 금지, 디자인 토큰 사용',
    },
    messages: {
      rawColor:
        '"{{value}}" 대신 의미 색 클래스(목록은 docs/DESIGN-TOKENS.md "의미 색")나 src/app/globals.css의 앱 전용 색 클래스를 쓰세요. 필요한 색이 없으면 packages/ui/tokens/에 토큰을 먼저 더합니다.',
    },
  },
  create(context) {
    function report(node, value) {
      if (typeof value !== 'string') {
        return;
      }

      const match = RAW_COLOR.exec(value);

      if (match) {
        context.report({ node, messageId: 'rawColor', data: { value: match[0] } });
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
