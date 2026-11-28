// 옛 shadcn 색 이름의 클래스를 막는 ESLint 규칙(eslint.config.js의 custom-tailwind/no-legacy-color).
// 옛 이름 27개는 새 의미 색(fg·bg·stroke)의 별칭으로 계속 동작하지만, 쓰는 곳을 새 이름으로 옮긴 층부터 다시 들이지
// 않게 막는다(2026-11-27 게이트 3 ④, docs/DESIGN-SYSTEM.md §5 "색 이름"). 앱 층은 PR 7에서 옮겼고, 공용 UI 부품은
// 5단계에서 옮긴 뒤 같은 규칙을 건다.
// 목록이 원본(packages/ui/tokens/shadcn.tokens.json)과 같은지는 단위 테스트가 본다
// (src/test/scripts/no-legacy-color-rule.test.ts). no-raw-color-rule.js와 같은 이유로 설정 파일 밖에 둔다.
// 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.
// (주석에 막는 클래스 이름을 그대로 적지 않는다 - Tailwind 스캐너가 이 파일도 훑어 쓰지 않는 유틸리티를 만든다.)

/** 옛 shadcn 색 이름(긴 이름부터 맞도록 정렬은 아래에서 한다) */
export const LEGACY_COLOR_NAMES = [
  'background',
  'foreground',
  'card',
  'card-foreground',
  'popover',
  'popover-foreground',
  'primary',
  'primary-foreground',
  'secondary',
  'secondary-foreground',
  'muted',
  'muted-foreground',
  'accent',
  'accent-foreground',
  'destructive',
  'destructive-foreground',
  'scrim',
  'scrim-foreground',
  'info',
  'info-foreground',
  'warning',
  'warning-foreground',
  'success',
  'success-foreground',
  'border',
  'input',
  'ring',
];

// 앞에 글자나 하이픈이 오면 더 긴 이름의 일부다(새 이름의 가운데 마디, --muted 같은 변수 이름)
const BEFORE = '(?<![\\w-])';
// 뒤에 글자나 하이픈이 오면 다른 이름이다. 투명도 수식자(/50)는 붙을 수 있다
const AFTER = '(?![\\w-])';
// 색을 받는 유틸리티. 하이픈으로 이어진 것과 테두리 한쪽 면은 통째로 적는다(위 경계 때문에 뒤 마디만으로는 잡히지 않는다)
const UTILITIES =
  'inset-shadow|inset-ring|drop-shadow|text-shadow|ring-offset|border-[xytrblse]|bg|text|border|ring|from|to|via|fill|stroke|divide|outline|shadow|decoration|accent|caret|placeholder';
const NAMES = [...LEGACY_COLOR_NAMES].sort((a, b) => b.length - a.length).join('|');
const LEGACY_COLOR = new RegExp(`${BEFORE}(?:${UTILITIES})-(?:${NAMES})${AFTER}`, 'g');

/** @type {import('eslint').Rule.RuleModule} */
export const noLegacyColorRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '옛 shadcn 색 이름 클래스 금지, 새 의미 색 이름 사용',
    },
    messages: {
      legacyColor:
        '"{{value}}"는 옛 shadcn 색 이름입니다. 새 의미 색 이름을 쓰세요(대응은 docs/DESIGN-TOKENS.md "의미 색"의 옛 이름 열. 글자는 fg, 배경은 bg, 선은 stroke 색).',
    },
  },
  create(context) {
    function report(node, value) {
      if (typeof value !== 'string') {
        return;
      }

      for (const match of value.matchAll(LEGACY_COLOR)) {
        context.report({ node, messageId: 'legacyColor', data: { value: match[0] } });
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
