// 배럴 파일을 막는 ESLint 규칙(eslint.config.js의 custom-barrel-rules). 예전 no-barrel-import는 import 문자열이
// /index로 끝날 때만 잡아 @/mocks/handlers 같은 암묵 해석이 통과했고, 파일 이름만 막으면 all.ts로 바꿔 빠져나간다.
// 그래서 파일 이름과 re-export 문법을 함께 본다. 금지 근거는 docs/PERFORMANCE.md "배럴 비교 (직접 측정)".
// no-literal-jsx-text-rule.js와 같은 이유로 설정 파일 밖에 두고 단위 테스트로 고정한다
// (src/test/scripts/no-barrel-rules.test.ts). 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.

const INDEX_FILE = /(^|[\\/])index\.tsx?$/;

/**
 * 파일 이름이 index.ts·index.tsx면 보고한다. 내용은 보지 않는다.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const noIndexFileRule = {
  meta: {
    type: 'problem',
    docs: {
      description: 'index.ts·index.tsx 파일 금지',
    },
    messages: {
      indexFile:
        'index 파일을 만들 수 없습니다. 하는 일이 드러나는 이름을 쓰고 직접 경로로 import하세요. (근거: docs/PERFORMANCE.md "배럴 비교 (직접 측정)")',
    },
  },
  create(context) {
    return {
      Program(node) {
        if (INDEX_FILE.test(context.filename)) {
          context.report({ node, messageId: 'indexFile' });
        }
      },
    };
  },
};

/**
 * 다른 모듈의 값을 다시 내보내는 문법을 보고한다. 타입 전용은 런타임에 사라져 모듈을 더 불러오지 않으므로 통과한다.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const noValueReExportRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '값 re-export 금지',
    },
    messages: {
      valueReExport:
        '다른 모듈의 값을 다시 내보낼 수 없습니다. 쓰는 곳에서 원래 파일을 직접 import하세요. (근거: docs/PERFORMANCE.md "배럴 비교 (직접 측정)")',
    },
  },
  create(context) {
    return {
      ExportAllDeclaration(node) {
        if (node.exportKind !== 'type') {
          context.report({ node, messageId: 'valueReExport' });
        }
      },
      ExportNamedDeclaration(node) {
        if (!node.source || node.exportKind === 'type') {
          return;
        }

        if (node.specifiers.some((specifier) => specifier.exportKind !== 'type')) {
          context.report({ node, messageId: 'valueReExport' });
        }
      },
    };
  },
};
