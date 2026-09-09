import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import unicornPlugin from 'eslint-plugin-unicorn';
import prettierConfig from 'eslint-config-prettier';
import prettierPlugin from 'eslint-plugin-prettier';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

// 파일명 약어 허용 목록
// PascalCase 규칙에서 예외로 처리할 약어들
const ALLOWED_ACRONYMS = ['UI']; // UI: User Interface

// date.util.ts(dayjs 구현 자체)와 테스트 파일에는 날짜 규칙을 적용하지 않는다 — ESLint
// flat config는 같은 rule key가 겹치는 files에 다시 나오면 배열을 병합하지 않고 통째로
// 덮어쓰므로, getState·클래스 컴포넌트 금지까지 같이 사라지지 않도록 공통 규칙을 상수로
// 빼서 두 블록에서 재사용한다.
const RESTRICTED_SYNTAX_COMMON = [
  // [금지] Zustand getState() 직접 호출
  // 이유: getState()는 상태 변경을 구독하지 않아 값이 바뀌어도 UI가 리렌더링되지 않음
  // 화살표 함수 컴포넌트/훅(`const useFoo = () => {...}`)도 잡도록 두 갈래로 나눴다 —
  // ArrowFunctionExpression은 ESTree상 `id`가 항상 null이라 원래 있던
  // `[id.name=...]` 단일 조건으로는 절대 매칭되지 않았다(2026-09-09 문서-코드 정합성
  // 감사 중 발견, 사각지대를 실제로 통과하는 위반은 없었음 — 예방 목적으로 승격).
  {
    selector:
      ':matches(:matches(FunctionDeclaration, FunctionExpression)[id.name=/^use|^[A-Z]/], VariableDeclarator[id.name=/^use|^[A-Z]/] > ArrowFunctionExpression) CallExpression[callee.property.name="getState"]',
    message:
      'getState() 대신 useStore((state) => state.value) Selector 패턴을 사용하세요. getState()는 상태 변경을 구독하지 않아 리렌더링되지 않습니다.',
  },
  // [금지] 클래스 컴포넌트 (extends Component)
  // 이유: Hooks 사용 불가, 로직 재사용 어려움(HOC/render props 필요), 번들 크기 증가, 테스트 복잡도 상승
  {
    selector: 'ClassDeclaration[superClass.name=/^(Pure)?Component$/]',
    message:
      '클래스 컴포넌트는 사용할 수 없습니다. 함수형 컴포넌트를 사용하세요. (Hooks 호환성, 코드 재사용성, 번들 크기 최적화)',
  },
  // [금지] 클래스 컴포넌트 (extends React.Component)
  {
    selector: 'ClassDeclaration[superClass.property.name=/^(Pure)?Component$/]',
    message:
      '클래스 컴포넌트는 사용할 수 없습니다. 함수형 컴포넌트를 사용하세요. (Hooks 호환성, 코드 재사용성, 번들 크기 최적화)',
  },
];

// [금지] 날짜 처리에 new Date()/.getTime() 직접 사용
// 이유: dayjs(value)는 문자열·Date 어느 쪽이 와도 안전한데, new Date(value)는 BE가 문자열을
// 보내는 경우 타입상 Date로 보여도 실제로 안전하지 않다(.claude/CLAUDE.md 날짜 처리 규칙).
// 문서 규칙만으로는 2026-03-15 도입 후 5개월간 위반이 안 잡혔던 사례가 있어 ESLint로 승격.
const RESTRICTED_SYNTAX_NO_NATIVE_DATE = [
  {
    selector: 'NewExpression[callee.name="Date"]',
    message: 'new Date() 대신 dayjs()를 사용하세요 (예: dayjs().toDate(), dayjs().toISOString()).',
  },
  {
    selector: 'CallExpression[callee.property.name="getTime"]',
    message: '.getTime() 대신 dayjs(value).valueOf()를 사용하세요.',
  },
];

// queryClient 싱글턴(config/queryClient.ts)을 상대 경로로 우회 import하는 것까지 잡기 위해
// 절대 경로 문자열과 상대 경로 접미사(끝이 /react-query/config/queryClient) 둘 다 검사한다.
const QUERY_CLIENT_SINGLETON_PATH = '@/shared/lib/react-query/config/queryClient';

/** import 선언 전체가 타입 전용인지 (`import type {...}` / `import { type X }`) */
function isTypeOnlyImport(node) {
  if (node.importKind === 'type') {
    return true;
  }

  return (
    node.specifiers.length > 0 &&
    node.specifiers.every((specifier) => specifier.importKind === 'type')
  );
}

const customQueryRulesPlugin = {
  rules: {
    // [금지] queryClient 싱글턴 직접 import
    // 이유: 싱글턴을 직접 잡으면 QueryClientProvider가 주입한 클라이언트와 다른 인스턴스를
    //       만질 수 있다. 프로덕션에선 같은 인스턴스라 티가 안 나지만, 테스트가 격리
    //       클라이언트를 써도 캐시 갱신은 싱글턴으로 새서 검증이 조용히 무의미해진다.
    'no-query-client-singleton-import': {
      meta: {
        type: 'problem',
        docs: { description: 'queryClient 싱글턴 직접 import 금지 (허용목록 방식)' },
        messages: {
          singletonImport:
            'queryClient 싱글턴을 직접 import할 수 없습니다. 컴포넌트·훅에서는 useQueryClient()를, .keys.ts 같은 비-훅 모듈에서는 queryClient를 첫 인자로 받으세요.',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value;

            if (typeof source !== 'string') {
              return;
            }

            if (
              source === QUERY_CLIENT_SINGLETON_PATH ||
              source.endsWith('/react-query/config/queryClient')
            ) {
              context.report({ node, messageId: 'singletonImport' });
            }
          },
        };
      },
    },
    // [금지] UI 컴포넌트에서 React Query 직접 import
    // 이유: UI(렌더링)와 데이터 fetching(비즈니스 로직)의 관심사 분리.
    //       쿼리·뮤테이션 정의는 *.queries.ts, 조합 로직은 hooks/의 커스텀 훅으로 분리한다.
    'no-direct-query-import': {
      meta: {
        type: 'problem',
        docs: { description: '@tanstack/react-query 직접 import 금지 (허용목록 방식)' },
        messages: {
          directQueryImport:
            '이 위치에서는 @tanstack/react-query를 직접 import할 수 없습니다. 쿼리·뮤테이션 정의는 *.queries.ts, 조합 로직은 hooks/의 커스텀 훅으로 분리하세요.',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value;

            if (typeof source !== 'string' || !source.startsWith('@tanstack/react-query')) {
              return;
            }

            // 타입 전용 import는 런타임 의존이 아니므로 허용한다
            // (.keys.ts가 `import type { QueryClient }`로 파라미터 타입만 쓰는 경우)
            if (isTypeOnlyImport(node)) {
              return;
            }

            context.report({ node, messageId: 'directQueryImport' });
          },
        };
      },
    },
    // [금지] features 슬라이스의 hooks/ 밖에서 entity 쿼리 훅 모듈(*.queries) import
    // 이유: FE-ARCHITECTURE §6 "feature hook = 모든 비즈니스 로직. UI 파일은 훅을 호출하고
    //       JSX만 렌더링" — 조회 위치를 hooks/로 고정한다. no-direct-query-import는
    //       @tanstack/react-query 직접 import만 막아, entity가 감싼 *.queries 훅 호출은
    //       문서 규칙으로만 남아 있었다(2026-09-09 조사에서 features 2건 확인 —
    //       CreatePostForm.tsx/UpdatePostForm.tsx가 useFetchCategoryOptionQuery를 UI에서
    //       직접 호출 중이었다).
    'no-entity-query-import-outside-hooks': {
      meta: {
        type: 'problem',
        docs: { description: 'features의 hooks/ 밖에서 entity *.queries 모듈 import 금지' },
        messages: {
          entityQueryImport:
            '이 위치에서는 entity 쿼리 훅(*.queries)을 직접 import할 수 없습니다. 조회는 같은 슬라이스의 hooks/ 커스텀 훅이나 entities/<entity>/hooks/의 공용 훅(예: useCategoryOptions)에서 하세요.',
        },
      },
      create(context) {
        return {
          ImportDeclaration(node) {
            const source = node.source.value;

            if (typeof source !== 'string' || !source.endsWith('.queries')) {
              return;
            }

            // 타입 전용 import는 런타임 의존이 아니므로 허용한다
            if (isTypeOnlyImport(node)) {
              return;
            }

            context.report({ node, messageId: 'entityQueryImport' });
          },
        };
      },
    },
  },
};

export default [
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    // '**/' 없이 'dist/**/*'로만 쓰면 중첩 경로(.claude/worktrees/*/dist/ 등)를 못 잡는다.
    ignores: [
      '**/dist/**',
      '**/storybook-static/**',
      '**/node_modules/**',
      '.claude/worktrees/**',
      '**/*.md',
      '**/*.svg',
      'infra/**/*',
    ],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    // 'src/*.d.ts'였던 패턴이 중첩 경로(src/types/lucide-react.d.ts)를 못 잡아, 그 파일
    // 하나만 수동 eslint-disable로 회피하고 있었다 — CLAUDE.md가 이미 별도로 경고하는
    // "ignore 패턴에 **/ prefix 누락" 실수의 같은 종류 재발(2026-09-09 문서-코드 정합성
    // 감사 중 발견). '**/*.d.ts'로 넓혀 src/ 안 모든 .d.ts를 동일하게 예외 처리한다.
    ignores: ['src/main.tsx', '**/*.d.ts'],
    plugins: {
      import: importPlugin,
      prettier: prettierPlugin,
      'react-hooks': reactHooksPlugin,
      'custom-react-hooks': {
        rules: {
          'no-hooks-in-regular-functions': {
            meta: {
              type: 'problem',
              docs: {
                description: '일반 함수에서 React Hooks 호출 금지',
              },
              messages: {
                hookInRegularFunction:
                  'React Hooks는 React 함수 컴포넌트나 커스텀 훅(use로 시작하는 함수) 내부에서만 호출할 수 있습니다. 일반 함수에서는 호출할 수 없습니다. 필요한 값은 파라미터로 전달하거나, 해당 함수를 커스텀 훅으로 변경하세요.',
              },
            },
            create(context) {
              // 훅 이름 패턴 (use로 시작하는 함수)
              const hookPattern = /^use[A-Z]/;

              // 함수가 React 컴포넌트인지 확인 (PascalCase로 시작)
              function isReactComponent(name) {
                return name && /^[A-Z]/.test(name);
              }

              // 함수가 커스텀 훅인지 확인 (use로 시작)
              function isCustomHook(name) {
                return name && hookPattern.test(name);
              }

              // 함수가 React.memo/forwardRef 등에 전달된 컴포넌트인지 확인
              function isWrappedByReactComponentWrapper(node) {
                if (
                  node.parent &&
                  node.parent.type === 'CallExpression' &&
                  node.parent.arguments &&
                  node.parent.arguments[0] === node
                ) {
                  const callee = node.parent.callee;
                  if (!callee) return false;
                  // React.memo(...), memo(...), React.forwardRef(...), forwardRef(...)
                  const name =
                    callee.type === 'Identifier'
                      ? callee.name
                      : callee.type === 'MemberExpression' && callee.property
                        ? callee.property.name
                        : null;
                  return name === 'memo' || name === 'forwardRef';
                }
                return false;
              }

              // 함수가 React 컴포넌트나 커스텀 훅인지 확인
              function isReactComponentOrHook(node) {
                // 함수 선언
                if (node.type === 'FunctionDeclaration' && node.id) {
                  return isReactComponent(node.id.name) || isCustomHook(node.id.name);
                }

                // 화살표 함수나 함수 표현식
                if (
                  (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') &&
                  node.parent
                ) {
                  // React.memo(() => {}) / forwardRef(() => {}) 내부는 컴포넌트로 간주
                  if (isWrappedByReactComponentWrapper(node)) {
                    return true;
                  }

                  // 변수 선언: const Component = () => {}
                  if (node.parent.type === 'VariableDeclarator' && node.parent.id) {
                    return (
                      isReactComponent(node.parent.id.name) || isCustomHook(node.parent.id.name)
                    );
                  }

                  // export default: export default () => {}
                  if (node.parent.type === 'ExportDefaultDeclaration') {
                    return true; // export default는 보통 컴포넌트
                  }

                  // 객체 메서드: { method() {} }
                  if (node.parent.type === 'Property' && node.parent.method) {
                    return false; // 일반 메서드는 허용하지 않음
                  }
                }

                return false;
              }

              // 훅 호출인지 확인
              function isHookCall(node) {
                if (node.type !== 'CallExpression') return false;

                const callee = node.callee;
                if (!callee) return false;

                // useXxx() 형태
                if (callee.type === 'Identifier') {
                  return hookPattern.test(callee.name);
                }

                // obj.useXxx() 형태 (예: store.useXxx())
                if (callee.type === 'MemberExpression' && callee.property) {
                  return hookPattern.test(callee.property.name);
                }

                return false;
              }

              return {
                CallExpression(node) {
                  if (!isHookCall(node)) return;

                  // 현재 함수 스코프 찾기
                  let current = node;
                  while (current) {
                    if (
                      current.type === 'FunctionDeclaration' ||
                      current.type === 'FunctionExpression' ||
                      current.type === 'ArrowFunctionExpression'
                    ) {
                      // React 컴포넌트나 커스텀 훅 내부면 허용
                      if (isReactComponentOrHook(current)) {
                        return;
                      }

                      // 일반 함수 내부면 에러
                      context.report({
                        node,
                        messageId: 'hookInRegularFunction',
                      });
                      return;
                    }
                    current = current.parent;
                  }
                },
              };
            },
          },
        },
      },
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        // 타입 정보가 필요한 규칙을 사용하므로 project 옵션 유지
        // 단, 스타일 파일은 제외
        project: ['./tsconfig.app.json'],
        // 워크트리(.claude/worktrees/<name>/)마다 자기 tsconfig.json을 가진 서브 체크아웃이라
        // 명시하지 않으면 typescript-eslint가 기준 디렉터리 후보를 여러 개 찾아 파싱 에러를 낸다
        // (에디터의 ESLint 확장에서만 재현됨 — CLI는 .claude/worktrees/** 를 ignores로 안 봄)
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        console: true,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Prettier 규칙 통합
      'prettier/prettier': 'error',
      eqeqeq: 'error',
      // if/else/for/while 등 제어문은 항상 중괄호 블록 사용 (인라인 금지)
      curly: ['error', 'all'],
      'no-var': 'error',
      'no-empty-pattern': 'error',
      'no-undef': 'off',
      'import/no-default-export': 'error',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          ignoreRestSiblings: true,
          args: 'none',
        },
      ],
      'prefer-const': 'error',
      '@typescript-eslint/no-explicit-any': 'off',
      // TypeScript 타입 체크 강화
      // warn이지만 package.json의 lint 스크립트가 --max-warnings 0이라 실제로는 error와
      // 동일하게 pnpm lint/pre-commit을 막는다(2026-09-09 문서-코드 정합성 감사 중, 이
      // 줄의 예전 주석 "ESLint가 실패하지 않도록"이 실제와 반대라는 걸 발견해 정정).
      // severity를 'warn'으로 유지한 이유는 tsc(type-check 스크립트)가 이미 이 타입
      // 에러들을 별도로 잡아내므로, ESLint 쪽에서는 --fix 등 도구가 warn/error를
      // 구분해 다르게 취급할 여지를 남겨두기 위함이다.
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // React Hooks 규칙
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Import 규칙: 일반 파일은 절대 경로(@/) 사용 강제
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/index.{ts,tsx}', 'src/main.tsx', 'src/app/App.tsx'],
    plugins: {
      'custom-import': {
        rules: {
          // 룰 key 이름(no-relative-import-except-styles)은 이 레포에 실재했던 styled-
          // components(.styles.ts) 컨벤션 시절 이름이 그대로 남은 것이다. 그 컨벤션은
          // 폐기됐고(레포에 .styles.ts 파일 자체가 없음, 2026-09-09 문서-코드 정합성
          // 감사 중 발견) 로직도 순수 "상대경로 금지"로 단순화했지만, 다른 곳에서
          // 이 rule key(:501)를 참조하므로 이름 자체는 안 바꿨다.
          'no-relative-import-except-styles': {
            meta: {
              type: 'problem',
              docs: {
                description: '일반 파일은 절대 경로(@/) 사용 강제, 상대 경로(./, ../) 금지',
              },
              messages: {
                relativeImport: './ 대신 @/를 사용한 절대 경로 import를 사용해주세요.',
              },
            },
            create(context) {
              return {
                ImportDeclaration(node) {
                  const importPath = node.source.value;
                  if (typeof importPath !== 'string') return;

                  if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    context.report({ node, messageId: 'relativeImport' });
                  }
                },
              };
            },
          },
          'no-sonner-toast-direct-import': {
            meta: {
              type: 'problem',
              docs: {
                description:
                  "'sonner'에서 toast를 직접 import 금지. @/shared/lib/toast/toast 를 사용해야 카테고리별 위치 정책(성공=하단, 오류=상단)이 적용됨",
              },
              messages: {
                sonnerDirectImport:
                  "'sonner'에서 toast를 직접 import할 수 없습니다. @/shared/lib/toast/toast 를 사용해주세요. (카테고리별 위치 정책 적용)",
              },
            },
            create(context) {
              return {
                ImportDeclaration(node) {
                  const importPath = node.source.value;
                  if (importPath !== 'sonner') return;

                  const filename = context.getFilename().replace(/\\/g, '/');
                  if (filename.includes('/src/shared/lib/toast/')) return;

                  const hasToastSpecifier = node.specifiers.some(
                    (specifier) =>
                      specifier.type === 'ImportSpecifier' && specifier.imported.name === 'toast'
                  );

                  if (hasToastSpecifier) {
                    context.report({ node, messageId: 'sonnerDirectImport' });
                  }
                },
              };
            },
          },
        },
      },
    },
    rules: {
      'custom-import/no-relative-import-except-styles': 'error',
      'custom-import/no-sonner-toast-direct-import': 'error',
    },
  },
  // 클릭 가능한 요소는 인터랙티브 시맨틱(button/role)이 필요 - 커스텀 규칙
  // onClick만 달린 div/span 등은 커서(globals.css 인터랙션 커서 규칙)와 키보드 접근성이
  // 모두 빠진다. INTERACTIVE_ROLES는 globals.css의 커서 규칙 선택자 목록과 동일하게 유지한다.
  {
    files: ['src/**/*.tsx'],
    ignores: ['**/*.stories.tsx', 'src/test/**/*.tsx'],
    plugins: {
      'custom-a11y': {
        rules: {
          'clickable-needs-interactive-element': {
            meta: {
              type: 'problem',
              docs: {
                description:
                  'onClick이 있는 비-인터랙티브 요소(div/span 등)는 Button 또는 role 지정 필요',
              },
              messages: {
                needsInteractiveElement:
                  '"{{tag}}"에 onClick만 달려 있습니다. @/shared/ui/atoms/button 의 Button(또는 <button>)을 사용하거나, 불가피하면 role="button"과 키보드 핸들러(onKeyDown)를 함께 지정해주세요.',
              },
            },
            create(context) {
              const NON_INTERACTIVE_TAGS = new Set([
                'div',
                'span',
                'li',
                'p',
                'img',
                'svg',
                'section',
                'article',
                'ul',
                'ol',
                'td',
                'tr',
                'header',
                'footer',
                'nav',
                'main',
                'aside',
                'figure',
                'h1',
                'h2',
                'h3',
                'h4',
                'h5',
                'h6',
              ]);
              const INTERACTIVE_ROLES = new Set([
                'button',
                'link',
                'menuitem',
                'menuitemcheckbox',
                'menuitemradio',
                'option',
                'tab',
                'switch',
                'checkbox',
                'radio',
              ]);

              function isIconComponent(name) {
                return /^[A-Z].*Icon$/.test(name);
              }

              return {
                JSXOpeningElement(node) {
                  if (node.name.type !== 'JSXIdentifier') {
                    return;
                  }
                  const tag = node.name.name;
                  if (!NON_INTERACTIVE_TAGS.has(tag) && !isIconComponent(tag)) {
                    return;
                  }

                  const hasOnClick = node.attributes.some(
                    (attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'onClick'
                  );
                  if (!hasOnClick) {
                    return;
                  }

                  const ariaHiddenAttr = node.attributes.find(
                    (attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'aria-hidden'
                  );
                  const isAriaHiddenTrue =
                    ariaHiddenAttr?.value?.type === 'Literal' &&
                    ariaHiddenAttr.value.value === 'true';
                  if (isAriaHiddenTrue) {
                    return;
                  }

                  const roleAttr = node.attributes.find(
                    (attr) => attr.type === 'JSXAttribute' && attr.name?.name === 'role'
                  );
                  if (roleAttr) {
                    // role이 문자열 리터럴이 아니면(동적 계산 등) 판단할 수 없으니 통과시킨다
                    if (roleAttr.value?.type !== 'Literal') {
                      return;
                    }
                    if (INTERACTIVE_ROLES.has(roleAttr.value.value)) {
                      return;
                    }
                  }

                  context.report({ node, messageId: 'needsInteractiveElement', data: { tag } });
                },
              };
            },
          },
        },
      },
    },
    rules: {
      'custom-a11y/clickable-needs-interactive-element': 'error',
    },
  },
  // 파일 명명 규칙 (unicorn/filename-case)
  // 비-ASCII 문자 검사 (한글 등) - 커스텀 규칙
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/index.{ts,tsx}'],
    plugins: {
      'custom-filename': {
        rules: {
          'no-non-ascii-filename': {
            meta: {
              type: 'problem',
              docs: {
                description: '파일명에 비-ASCII 문자 사용 금지',
              },
              messages: {
                nonAscii:
                  '파일명 "{{filename}}"에 비-ASCII 문자가 포함되어 있습니다. ASCII 문자만 사용해주세요.',
              },
            },
            create(context) {
              return {
                Program(node) {
                  const filename = context.getFilename();
                  const basename = filename.split('/').pop() || '';
                  // 확장자 제거
                  const nameWithoutExt = basename.replace(/\.(ts|tsx|js|jsx)$/, '');
                  // 비-ASCII 문자 검사 (한글, 한자, 일본어 등)
                  const nonAsciiRegex = /[^\x00-\x7F]/;
                  if (nonAsciiRegex.test(nameWithoutExt)) {
                    context.report({
                      node,
                      messageId: 'nonAscii',
                      data: {
                        filename: basename,
                      },
                    });
                  }
                },
              };
            },
          },
        },
      },
    },
    rules: {
      'custom-filename/no-non-ascii-filename': 'error',
    },
  },
  // Atoms 폴더: kebab-case
  {
    files: ['src/shared/ui/atoms/**/*.{ts,tsx}'],
    ignores: ['**/index.{ts,tsx}'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  // 컴포넌트 파일: PascalCase
  {
    files: ['src/**/*.tsx'],
    ignores: [
      'src/main.tsx',
      'src/app/App.tsx',
      '**/index.tsx',
      'src/test/**/*.{ts,tsx}',
      'src/shared/ui/atoms/**/*.tsx', // atoms 폴더는 위 규칙에서 처리
      // 약어로 시작하는 파일명 허용 (UI, URL 등)
      ...ALLOWED_ACRONYMS.map((acronym) => `**/${acronym}*.tsx`),
    ],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'pascalCase' }],
    },
  },
  // Custom Hook 파일: camelCase (use*.ts, use*.tsx)
  // 원래 'use*.tsx'만 대상이었는데, 이 레포의 실제 훅 파일은 전부 .ts라 이 블록이
  // use*.test.tsx 12개(JSX Wrapper가 필요해 .tsx인 테스트 파일)만 우연히 검증하고
  // 정작 훅 본체 53개는 아무 파일명 규칙도 안 받고 있었다(2026-09-09 문서-코드
  // 정합성 감사 중 발견, 이미 전부 camelCase로 지켜지고 있어 위반은 없었음 — 예방
  // 목적으로 승격). .ts를 추가해 둘 다 검증한다.
  {
    files: ['src/**/use*.{ts,tsx}'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'camelCase' }],
    },
  },
  // 유틸리티 파일: kebab-case (common.util.ts, date.util.ts 등)
  {
    files: ['src/**/utils/**/*.{ts,tsx}'],
    ignores: ['**/index.ts'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  // API 파일: kebab-case.api.ts
  {
    files: ['src/**/*.api.ts'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  // Queries 파일: kebab-case.queries.ts
  {
    files: ['src/**/*.queries.ts'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  // 타입 파일: kebab-case (shared/types 폴더)
  {
    files: ['src/**/types/**/*.ts'],
    ignores: ['**/index.ts'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  // Schema 파일: kebab-case.schema.ts
  {
    files: ['src/**/*.schema.ts'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  // 설정 파일: kebab-case (config 폴더)
  // ignores가 원래 'src/**/config/*.ts'(config 폴더 직속 자식 전부)였는데, 이 레포의
  // config 파일 12개가 전부 직속 자식이라 사실상 이 블록 전체가 무력화돼 있었다
  // (2026-09-09 문서-코드 정합성 감사 중 발견). queryClient.ts(camelCase)만 리네임
  // 범위가 커서 개별 예외로 남기고 나머지 11개는 검사 대상으로 되돌렸다 — 되돌린
  // 상태로도 위반 0건임을 확인했다.
  {
    files: ['src/**/config/**/*.ts'],
    ignores: ['**/index.ts', 'src/shared/lib/react-query/config/queryClient.ts'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'kebabCase' }],
    },
  },
  // index.ts 파일은 예외 처리
  {
    files: ['**/index.{ts,tsx}'],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': 'off',
    },
  },

  // ============================================================
  // 프로젝트 금지 패턴 (no-restricted-syntax)
  // ============================================================
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/shared/utils/date.util.ts', '**/*.test.{ts,tsx}', 'src/mocks/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...RESTRICTED_SYNTAX_COMMON,
        ...RESTRICTED_SYNTAX_NO_NATIVE_DATE,
      ],
    },
  },
  // date.util.ts(dayjs 구현 자체)·테스트 파일·MSW mocks(fixture·handler — 실행 중 BE 응답이
  // 아니라 테스트가 직접 통제하는 리터럴 날짜라 dayjs 안전성 문제가 없다)는 날짜 규칙만
  // 제외 — getState·클래스 컴포넌트 금지는 그대로 적용한다(ESLint flat config는 같은 rule
  // key가 겹치는 files에 다시 나오면 배열을 병합하지 않고 통째로 덮어쓰므로, 공통 규칙을
  // 여기서도 명시해야 사라지지 않는다)
  {
    files: ['src/shared/utils/date.util.ts', '**/*.test.{ts,tsx}', 'src/mocks/**'],
    rules: {
      'no-restricted-syntax': ['error', ...RESTRICTED_SYNTAX_COMMON],
    },
  },

  // (Zustand getState() 금지는 위 RESTRICTED_SYNTAX_COMMON에 이미 포함돼 있다 — 여기 있던
  // 중복 블록은 제거했다. ESLint flat config는 같은 rule key가 겹치는 files에 다시 나오면
  // 배열을 병합하지 않고 통째로 덮어쓰므로, 이 중복이 위 블록의 no-restricted-syntax 전체
  // (getState + 클래스 컴포넌트 금지 + 이번에 추가한 dayjs 규칙)를 무력화하고 있었다 —
  // 2026-09-08 dayjs 규칙 추가 중 발견)
  // ============================================================
  // [금지] queryClient 싱글턴 직접 import — src/** 전체 금지 + 허용목록
  // 이유: 싱글턴을 직접 잡으면 QueryClientProvider가 주입한 클라이언트와 다른 인스턴스를
  //       만질 수 있다. 프로덕션에선 같은 인스턴스라 티가 안 나지만, 테스트가 격리
  //       클라이언트를 써도 캐시 갱신은 싱글턴으로 새서 검증이 조용히 무의미해진다
  //       (2026-09-09 이전 entities/*/api/*.queries.test.ts가 전부 이 이유로 싱글턴을
  //       provider에 직접 꽂고 있었다).
  // 주의: no-restricted-imports로 쓰면 아래 FSD 레이어 블록이 같은 rule key를 다시
  //       선언해 통째로 덮어쓴다 — 그래서 고유 rule key의 커스텀 룰로 만들었다.
  // ============================================================
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      // 싱글턴을 provider에 주입하는 유일한 지점
      'src/app/providers/QueryProvider.tsx',
      // clearAll()/clearQueries()가 React 트리 밖(fetch 인터셉터, 전역 캐시 에러 핸들러)
      // 에서 호출되어 useQueryClient()를 쓸 수 없다
      'src/shared/utils/auth.util.ts',
    ],
    plugins: { 'custom-query-rules': customQueryRulesPlugin },
    rules: {
      'custom-query-rules/no-query-client-singleton-import': 'error',
    },
  },

  // ============================================================
  // [금지] @tanstack/react-query 직접 import — src/** 전체 금지 + 허용목록
  // 이유: UI(렌더링)와 데이터 fetching(비즈니스 로직)의 관심사 분리. 이전엔 src/**/ui/**만
  //       막았는데, 그러면 ui/ 밖이면 아무 데서나 훅을 쓸 수 있어 3-Layer 계약이 실질적으로
  //       강제되지 않았다 → 허용목록 방식으로 전환(2026-09-09).
  // 타입 전용 import(import type { QueryClient })는 룰 구현에서 통과시킨다.
  // ============================================================
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      // 앱 부트스트랩 — QueryProvider, QueryErrorResetBoundary
      'src/app/**/*.{ts,tsx}',
      // React Query 인프라 자체 (queryClient.ts, utils/hooks.ts)
      'src/shared/lib/react-query/**/*.{ts,tsx}',
      // 전역 focusManager 제어
      'src/shared/hooks/useWindowFocusManager.ts',
      // 3-Layer API의 Layer 3 — 쿼리·뮤테이션 훅을 정의하는 자리
      'src/**/api/*.queries.ts',
      // hooks/ 세그먼트 — entity/feature/widget 커스텀 훅
      'src/**/hooks/**/*.{ts,tsx}',
      // pages엔 hooks/ 세그먼트가 없다. 한 줄짜리 invalidate만 있어 훅으로 뺄 정도가
      // 아니므로 파일 단위 예외로 둔다
      'src/pages/post/PostDetailPage.tsx',
      // 테스트 인프라·콜로케이션 테스트
      'src/test/**/*.{ts,tsx}',
      '**/*.test.{ts,tsx}',
    ],
    plugins: { 'custom-query-rules': customQueryRulesPlugin },
    rules: {
      'custom-query-rules/no-direct-query-import': 'error',
    },
  },

  // ============================================================
  // [금지] features 레이어의 hooks/ 밖에서 entity 쿼리 훅(*.queries) import
  // 이유: FE-ARCHITECTURE §6은 features에 예외를 두지 않는다(§8의 "query 1개 + trivial
  //       파생" 예외는 widgets 한정). ui/만 막으면 utils/·config/로 새므로
  //       no-direct-query-import와 같은 허용목록 방식(hooks/만 허용)을 쓴다.
  // widgets는 이 블록의 대상이 아니다: §8 예외는 "파생이 trivial한가"라는 사람 판단이라
  //       ESLint가 평가할 수 없다. 파일 단위 ignore로 흉내 내면 그 파일에 앞으로 들어올
  //       모든 쿼리까지 영구 면제가 되므로, widgets는 문서(§8)와 /code-review로 지킨다.
  // ============================================================
  {
    files: ['src/features/**/*.{ts,tsx}'],
    ignores: ['src/features/**/hooks/**/*.{ts,tsx}', '**/*.test.{ts,tsx}'],
    plugins: { 'custom-query-rules': customQueryRulesPlugin },
    rules: {
      'custom-query-rules/no-entity-query-import-outside-hooks': 'error',
    },
  },

  // ============================================================
  // [금지] 배럴 파일(index.ts) import
  // 이유: 배럴 파일은 수천 개의 모듈을 한꺼번에 로드하여 dev server 부팅 15-70% 지연,
  //       빌드 28% 지연, cold start 40% 지연을 유발함. 직접 파일 경로로 import해야
  //       Tree Shaking이 정상 동작하고 번들 크기가 최적화됨
  //       (수치 출처 미상 — 2026-09-08 확인, 이 레포에서 직접 측정하거나 외부
  //       출처를 링크한 기록 없음. 재검증 전까지 참고용으로만 취급할 것)
  // ============================================================
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['**/index.{ts,tsx}'],
    plugins: {
      'custom-barrel-rules': {
        rules: {
          'no-barrel-import': {
            meta: {
              type: 'problem',
              docs: {
                description: '배럴 파일(index.ts)에서 import 금지',
              },
              messages: {
                barrelImport:
                  '배럴 파일(index.ts)에서 import하지 마세요. 구체적인 파일 경로를 사용하세요. (예: @/shared/ui/atoms/button/Button) Tree Shaking 최적화를 위해 직접 import만 허용합니다.',
              },
            },
            create(context) {
              return {
                ImportDeclaration(node) {
                  const source = node.source.value;
                  if (typeof source !== 'string') return;

                  if (
                    source.match(/\/index(['"]|$)/) ||
                    source.endsWith('/index.ts') ||
                    source.endsWith('/index.tsx')
                  ) {
                    context.report({ node, messageId: 'barrelImport' });
                  }
                },
              };
            },
          },
        },
      },
    },
    rules: {
      'custom-barrel-rules/no-barrel-import': 'error',
    },
  },

  // ============================================================
  // [금지] 한글 UI 문자열 하드코딩
  // 이유: 모든 사용자 노출 문자열은 src/shared/config/texts.ts의 TEXTS로
  //       중앙 관리해야 함. 직접 작성 시 다국어/문구 일관성 관리가 불가능해짐.
  //       texts.ts 자기 자신과 테스트/목 픽스처는 예외.
  // ============================================================
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/shared/config/texts.ts', // TEXTS 단일 소스
      'src/test/**/*.{ts,tsx}', // 테스트 인프라
      'src/mocks/**/*.{ts,tsx}', // MSW 목/픽스처
      '**/*.test.{ts,tsx}', // 콜로케이션 테스트
      '**/*.stories.{ts,tsx}', // Storybook
      'src/shared/utils/date.util.ts', // 날짜 로케일 포맷 (i18n 예외)
      'src/shared/utils/common.util.ts', // 숫자/통화 로케일 포맷 (i18n 예외)
    ],
    plugins: {
      'custom-i18n': {
        rules: {
          'no-hardcoded-hangul': {
            meta: {
              type: 'problem',
              docs: {
                description: '한글 UI 문자열 하드코딩 금지 (TEXTS로 중앙 관리)',
              },
              messages: {
                hardcodedHangul:
                  '한글 UI 문자열은 직접 작성할 수 없습니다. src/shared/config/texts.ts의 TEXTS.*에 키를 추가한 뒤 참조하세요.',
              },
            },
            create(context) {
              // 한글(완성형/자모/호환자모) 감지
              const hangulRegex = /[가-힣ᄀ-ᇿ㄰-㆏]/;

              function report(node, value) {
                if (typeof value === 'string' && hangulRegex.test(value)) {
                  context.report({ node, messageId: 'hardcodedHangul' });
                }
              }

              return {
                JSXText(node) {
                  report(node, node.value);
                },
                Literal(node) {
                  // import 경로 등은 Literal이지만 한글이 없으므로 자연히 통과
                  report(node, node.value);
                },
                TemplateLiteral(node) {
                  for (const quasi of node.quasis) {
                    report(quasi, quasi.value.raw);
                  }
                },
              };
            },
          },
        },
      },
    },
    rules: {
      'custom-i18n/no-hardcoded-hangul': 'error',
    },
  },

  // ============================================================
  // FSD 레이어 경계 규칙: app → pages → widgets → features → entities → shared
  // 하위 레이어는 상위 레이어를 import할 수 없음
  // ============================================================

  // shared (최하위): entities, features, widgets, pages, app import 불가
  {
    files: ['src/shared/**/*.ts', 'src/shared/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/entities/**'],
              message: 'shared 레이어는 entities 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/features/**'],
              message: 'shared 레이어는 features 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/widgets/**'],
              message: 'shared 레이어는 widgets 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/pages/**'],
              message: 'shared 레이어는 pages 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/app/**'],
              message: 'shared 레이어는 app 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
          ],
        },
      ],
    },
  },

  // entities: features, widgets, pages, app import 불가 (shared OK)
  {
    files: ['src/entities/**/*.ts', 'src/entities/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/**'],
              message: 'entities 레이어는 features 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/widgets/**'],
              message: 'entities 레이어는 widgets 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/pages/**'],
              message: 'entities 레이어는 pages 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/app/**'],
              message: 'entities 레이어는 app 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
          ],
        },
      ],
    },
  },

  // features: widgets, pages, app import 불가 (entities, shared OK)
  {
    files: ['src/features/**/*.ts', 'src/features/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/widgets/**'],
              message: 'features 레이어는 widgets 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/pages/**'],
              message: 'features 레이어는 pages 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/app/**'],
              message: 'features 레이어는 app 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
          ],
        },
      ],
    },
  },

  // widgets: pages, app import 불가 (features, entities, shared OK)
  {
    files: ['src/widgets/**/*.ts', 'src/widgets/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/pages/**'],
              message: 'widgets 레이어는 pages 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
            {
              group: ['@/app/**'],
              message: 'widgets 레이어는 app 레이어를 import할 수 없습니다. (역방향 의존성)',
            },
          ],
        },
      ],
    },
  },

  // pages: app import 불가 (widgets, features, entities, shared OK)
  {
    files: ['src/pages/**/*.ts', 'src/pages/**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/app/**'],
              message:
                'pages 레이어는 app 레이어를 import할 수 없습니다. (app → pages 순서만 허용)',
            },
          ],
        },
      ],
    },
  },
];
