// 범용 공용 UI 부품이 이 앱에 묶이지 않게 막는 ESLint 규칙(eslint.config.js의
// custom-design-system/no-app-import-in-generic-ui). 문구·라우터만 막으면 인증 스토어 같은 새 결합을 못 잡아
// 허용 목록 방식으로 쓴다 - @/ 경로는 @/shared/ui/**와 아래 목록만 통과하고, 외부 패키지는 라우터만 막는다.
// 대상 파일과 앱 전용 예외 목록은 eslint.config.js에 있다(분류 근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §5).
// 상대 경로 import는 custom-import/no-relative-import-except-styles가 막아 여기서 보지 않는다.
// no-barrel-rules.js와 같은 이유로 설정 파일 밖에 두고 단위 테스트로 고정한다
// (src/test/scripts/ui-boundary-rule.test.ts). 패키지는 import하지 않는다 - dependency-cruiser가 이 디렉터리 안까지 따라간다.

const GENERIC_UI_PREFIX = '@/shared/ui/';
const ROUTER_PACKAGE = /^react-router(-dom)?(\/|$)/;

/** 부품과 함께 옮길 보조 모듈 - 통째로 허용한다(docs/DESIGN-SYSTEM-PRINCIPLES.md §5.5) */
const ALLOWED_MODULES = new Set([
  '@/shared/lib/tailwind/utils',
  '@/shared/hooks/useClickGuard',
  '@/shared/hooks/useOpenClickGuard',
  '@/shared/hooks/useMergedRef',
  '@/shared/hooks/useDelayedLoading',
  '@/shared/hooks/useKeydown',
  '@/shared/lib/toast/toast',
  '@/shared/lib/toast/toast-layout',
  '@/shared/lib/image/failedImageCache',
  '@/shared/utils/scroll.util',
]);

/**
 * 앱 것과 섞여 있는 파일 - 적힌 이름만 허용한다. 값이 배열이면 그 이름의 멤버도 적힌 것만 쓸 수 있다
 * (CommonUtil은 클래스 하나에 앱 유틸이 함께 들어 있다).
 */
const ALLOWED_NAMES = {
  '@/shared/config/const': { LOADING_INDICATOR_DELAY_MS: null, DOUBLE_CLICK_GUARD_MS: null },
  '@/shared/types/common.type': { SelectOptionType: null },
  '@/shared/utils/common.util': { CommonUtil: ['commaizeNumber'] },
};

/**
 * 범용 공용 UI 부품과 그 보조 모듈의 import를 본다. 타입 전용 import도 본다 - 타입도 패키지로 함께 옮겨야 쓸 수 있다.
 *
 * @type {import('eslint').Rule.RuleModule}
 */
export const noAppImportInGenericUiRule = {
  meta: {
    type: 'problem',
    docs: {
      description: '범용 공용 UI 부품에서 허용 목록 밖의 앱 모듈·라우터 import 금지',
    },
    messages: {
      router:
        '범용 공용 UI 부품은 라우터({{source}})를 import할 수 없습니다. 링크·이동은 쓰는 쪽이 속성(슬롯·콜백)으로 넘깁니다. (근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §1)',
      module:
        '범용 공용 UI 부품은 {{source}}를 import할 수 없습니다. @/shared/ui/**와 허용 목록(scripts/lib/ui-boundary-rule.js)만 됩니다. 부품이 스스로 보여 주는 글자는 useUiTexts()로 읽고, 앱 전용 부품이면 eslint.config.js의 예외 목록에 적습니다. (근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §1)',
      name: '범용 공용 UI 부품은 {{source}}에서 {{allowed}}만 가져올 수 있습니다({{name}}). 이 파일에는 앱 것이 함께 들어 있습니다. (근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §5.5)',
      member:
        '범용 공용 UI 부품은 {{name}}에서 {{allowed}}만 쓸 수 있습니다. 이 클래스에는 앱 것이 함께 들어 있습니다. (근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §5.5)',
    },
  },
  create(context) {
    /** 경로가 막힌 것이면 보고한다. 이름 단위로 봐야 하는 모듈이면 허용된 이름 표를 돌려준다 */
    function checkSource(sourceNode) {
      const source = sourceNode.value;

      if (ROUTER_PACKAGE.test(source)) {
        context.report({ node: sourceNode, messageId: 'router', data: { source } });
        return undefined;
      }

      const isOutsideApp = !source.startsWith('@/');

      if (isOutsideApp || source.startsWith(GENERIC_UI_PREFIX) || ALLOWED_MODULES.has(source)) {
        return undefined;
      }

      const allowedNames = ALLOWED_NAMES[source];

      if (!allowedNames) {
        context.report({ node: sourceNode, messageId: 'module', data: { source } });
      }

      return allowedNames;
    }

    function reportName(node, source, name, allowedNames) {
      context.report({
        node,
        messageId: 'name',
        data: { source, name, allowed: Object.keys(allowedNames).join(', ') },
      });
    }

    /** 가져온 이름을 쓰는 자리가 모두 허용된 멤버 접근(CommonUtil.commaizeNumber)인지 본다 */
    function checkMembers(specifier, name, allowedMembers) {
      const [variable] = context.sourceCode.getDeclaredVariables(specifier);

      for (const { identifier } of variable?.references ?? []) {
        const parent = identifier.parent;
        const isAllowedMember =
          parent.type === 'MemberExpression' &&
          parent.object === identifier &&
          !parent.computed &&
          allowedMembers.includes(parent.property.name);

        if (!isAllowedMember) {
          context.report({
            node: identifier,
            messageId: 'member',
            data: { name, allowed: allowedMembers.map((member) => `${name}.${member}`).join(', ') },
          });
        }
      }
    }

    /** 다시 내보내기·동적 import는 이름을 가려 볼 수 없어, 이름 단위로만 허용한 모듈이면 통째로 막는다 */
    function checkWholeModule(node) {
      if (node.source?.type !== 'Literal' || typeof node.source.value !== 'string') {
        return;
      }

      const allowedNames = checkSource(node.source);

      if (allowedNames) {
        reportName(node.source, node.source.value, '*', allowedNames);
      }
    }

    return {
      ImportDeclaration(node) {
        const allowedNames = checkSource(node.source);

        if (!allowedNames) {
          return;
        }

        for (const specifier of node.specifiers) {
          // default·namespace import는 파일 전체를 가져온다
          const name =
            specifier.type === 'ImportSpecifier'
              ? (specifier.imported.name ?? specifier.imported.value)
              : '*';

          if (!Object.hasOwn(allowedNames, name)) {
            reportName(specifier, node.source.value, name, allowedNames);
            continue;
          }

          const allowedMembers = allowedNames[name];

          if (allowedMembers) {
            checkMembers(specifier, name, allowedMembers);
          }
        }
      },
      ExportNamedDeclaration: checkWholeModule,
      ExportAllDeclaration: checkWholeModule,
      ImportExpression: checkWholeModule,
    };
  },
};
