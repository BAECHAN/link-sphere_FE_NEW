// 의미 색의 종류와 속성이 맞는지 보는 ESLint 규칙(eslint.config.js의 custom-tailwind/semantic-color-kind).
// 의미 색 이름은 종류로 시작한다: 글자 fg-, 배경 bg-, 선 stroke-(2026-11-27 게이트 3, docs/DESIGN-SYSTEM.md §5 "색 이름").
// 글자 색 유틸리티에는 fg-, 배경 유틸리티에는 bg-, 테두리·링·외곽선·구분선에는 stroke- 색만 붙인다. 배경 색을 글자에
// 쓰는 식이면 한쪽 값만 고쳐도 다른 쪽 화면이 함께 바뀐다.
// 일부러 다른 종류를 쓰는 곳은 그 줄에 eslint-disable-next-line과 이유를 단다.
// 보지 않는 것: 옛 shadcn 이름(종류가 이름에 없다), SVG의 fill·stroke, 그림자·accent 색, 대괄호·괄호 값.
// no-raw-shadow-rule.js와 같은 이유로 설정 파일 밖에 두고 단위 테스트로 고정한다
// (src/test/scripts/semantic-color-kind-rule.test.ts).
// 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.
// (주석에 클래스 이름을 그대로 적지 않는다 - Tailwind 스캐너가 이 파일도 훑어 쓰지 않는 유틸리티를 만든다.)

// 유틸리티마다 받는 색 종류. 테두리는 한쪽 면(x, y, t, r, b, l, s, e)에만 붙이는 꼴도 같다
const KIND_BY_UTILITY = [
  ['text|placeholder|decoration|caret', 'fg'],
  ['bg|from|via|to', 'bg'],
  ['border(?:-[xytrblse])?|ring-offset|ring|inset-ring|outline|divide', 'stroke'],
];
// 앞에 글자나 하이픈이 오면 더 긴 이름의 일부다(bg-bg-…의 두 번째 bg)
const BEFORE = '(?<![\\w-])';
const UTILITY_GROUPS = KIND_BY_UTILITY.map(([utilities]) => `(${utilities})`).join('|');
const SEMANTIC_COLOR = new RegExp(
  `${BEFORE}(?:${UTILITY_GROUPS})-((fg|bg|stroke)-[a-z0-9-]+)`,
  'g'
);
const KIND_LABEL = { fg: '글자(fg)', bg: '배경(bg)', stroke: '선(stroke)' };

/** @type {import('eslint').Rule.RuleModule} */
export const semanticColorKindRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '의미 색의 종류(fg·bg·stroke)와 유틸리티의 속성을 맞춘다',
    },
    messages: {
      wrongKind:
        '"{{value}}": {{utility}}에는 {{expected}} 색을 씁니다. {{actual}} 색 "{{color}}" 대신 같은 역할의 {{expected}} 색을 고르세요(목록은 docs/DESIGN-TOKENS.md "의미 색"). 일부러 다른 종류를 쓰면 그 줄에 eslint-disable-next-line custom-tailwind/semantic-color-kind -- <이유>를 답니다.',
    },
  },
  create(context) {
    function report(node, value) {
      if (typeof value !== 'string') {
        return;
      }

      for (const match of value.matchAll(SEMANTIC_COLOR)) {
        const groupIndex = KIND_BY_UTILITY.findIndex((_, index) => match[index + 1] !== undefined);
        const utility = match[groupIndex + 1];
        const expected = KIND_BY_UTILITY[groupIndex][1];
        const [, , , , color, actual] = match;

        if (actual !== expected) {
          context.report({
            node,
            messageId: 'wrongKind',
            data: {
              value: match[0],
              utility,
              color,
              expected: KIND_LABEL[expected],
              actual: KIND_LABEL[actual],
            },
          });
        }
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
