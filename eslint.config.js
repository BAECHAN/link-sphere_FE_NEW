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

export default [
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    ignores: ['dist/**/*', 'node_modules/**/*', '**/*.md', '**/*.svg'],
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/main.tsx', '**/*.styles.ts', '**/*.styles.tsx', 'src/*.d.ts'],
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
      },
      globals: {
        console: true,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: './tsconfig.app.json',
        },
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      // Prettier 규칙 통합
      'prettier/prettier': 'error',
      eqeqeq: 'error',
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
      // 타입 정보가 필요한 규칙이지만, 타입 에러가 있어도 ESLint가 실패하지 않도록 warn으로 설정
      '@typescript-eslint/no-unsafe-assignment': 'warn',
      '@typescript-eslint/no-unsafe-member-access': 'warn',
      '@typescript-eslint/no-unsafe-call': 'warn',
      '@typescript-eslint/no-unsafe-return': 'warn',

      // React Hooks 규칙
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // 스타일 파일에 대한 특별 규칙
  {
    files: ['**/*.styles.ts', '**/*.styles.tsx'],
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: {
          jsx: true,
        },
        // 타입 정보가 필요한 규칙을 사용하지 않으므로 project 옵션 제거
        // 타입 체크는 TypeScript 컴파일러가 담당
      },
    },
    rules: {
      // 스타일 파일에서는 타입 정보가 필요한 규칙 비활성화
      // 타입 에러는 TypeScript 컴파일러가 체크하므로 ESLint에서 중복 체크 불필요
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
    },
  },
  // Import 규칙: 일반 파일은 절대 경로(@/) 사용 강제, 스타일 파일은 같은 디렉토리에서만 상대 경로(./) 사용
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      '**/index.{ts,tsx}',
      'src/main.tsx',
      'src/app/App.tsx',
      '**/*.styles.ts',
      '**/*.styles.tsx',
    ],
    plugins: {
      'custom-import': {
        rules: {
          'no-relative-import-except-styles': {
            meta: {
              type: 'problem',
              docs: {
                description:
                  '일반 파일은 절대 경로 사용 강제, 스타일 파일은 같은 디렉토리에서만 상대 경로 허용',
              },
              messages: {
                relativeImport:
                  './ 대신 @/를 사용한 절대 경로 import를 사용해주세요. (단, 스타일 파일은 같은 디렉토리에서 ./로 import 가능)',
                absoluteStylesImport:
                  '❌ 스타일 파일은 같은 디렉토리 내에서만 상대 경로(./)로 import해야 합니다 (예: "./ComponentName.styles"). 절대 경로(@/)나 다른 디렉토리(../)는 사용할 수 없습니다.',
              },
            },
            create(context) {
              return {
                ImportDeclaration(node) {
                  const importPath = node.source.value;
                  if (typeof importPath !== 'string') return;

                  // 스타일 파일인지 확인 (.styles 포함 여부)
                  const isStylesFile = importPath.includes('.styles');

                  // 절대 경로로 스타일 파일 import하는 경우 에러
                  if (importPath.startsWith('@/') && isStylesFile) {
                    context.report({
                      node,
                      messageId: 'absoluteStylesImport',
                    });
                    return;
                  }

                  // 상위 디렉토리로 가는 스타일 파일 import 금지
                  if (importPath.startsWith('../') && isStylesFile) {
                    context.report({
                      node,
                      messageId: 'absoluteStylesImport',
                    });
                    return;
                  }

                  // 상대 경로인지 확인
                  if (importPath.startsWith('./') || importPath.startsWith('../')) {
                    // 같은 디렉토리에서 ./로 시작하는 스타일 파일은 허용
                    if (importPath.startsWith('./') && isStylesFile) {
                      return;
                    }
                    // 스타일 파일이 아닌 경우 에러
                    if (!isStylesFile) {
                      context.report({
                        node,
                        messageId: 'relativeImport',
                      });
                    }
                  }
                },
              };
            },
          },
          'no-mantine-ui-direct-import': {
            meta: {
              type: 'problem',
              docs: {
                description:
                  '@mantine/core, @mantine/dates, @mantine/charts 등 Mantine UI 라이브러리에서 직접 import 금지. shared/ui/atoms/ 또는 src/app/에서만 허용',
              },
              messages: {
                mantineDirectImport:
                  '@mantine/core, @mantine/dates, @mantine/charts 등 Mantine UI 라이브러리에서 직접 import하는 것은 금지됩니다. 대신 @/shared/ui/elements/에서 해당 컴포넌트를 import해주세요. (단, shared/ui/elements/ 내부 파일과 src/app/ 내부 파일에서는 예외)',
              },
            },
            create(context) {
              return {
                ImportDeclaration(node) {
                  const importPath = node.source.value;
                  if (typeof importPath !== 'string') return;

                  // @mantine/core에서 import하는 경우만 체크
                  if (importPath !== '@mantine/core') return;

                  const filename = context.getFilename();
                  // 파일 경로를 정규화 (백슬래시를 슬래시로 변환)
                  const normalizedPath = filename.replace(/\\/g, '/');

                  // 허용된 경로 체크
                  // src/shared/ui/atoms/ 또는 src/app/ 경로에 있는 파일만 허용
                  const isAllowedPath =
                    normalizedPath.includes('/src/shared/ui/atoms/') ||
                    normalizedPath.includes('/src/app/');

                  if (!isAllowedPath) {
                    context.report({
                      node,
                      messageId: 'mantineDirectImport',
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
      'custom-import/no-relative-import-except-styles': 'error',
      'custom-import/no-mantine-ui-direct-import': 'error',
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              // 상위 디렉토리로 가는 상대 경로 금지 (일반 파일)
              group: [
                '../**/*.ts',
                '../**/*.tsx',
                '../**/*.js',
                '../**/*.jsx',
                '../../**/*.ts',
                '../../**/*.tsx',
                '../../../**/*.ts',
                '../../../**/*.tsx',
                '..',
                '../*',
              ],
              message: '../ 대신 @/를 사용한 절대 경로 import를 사용해주세요.',
            },
          ],
        },
      ],
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
      'src/App.tsx',
      '**/index.tsx',
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
  // 스타일 파일: PascalCase.styles.ts
  {
    files: ['src/**/*.styles.ts'],
    ignores: [
      // 약어로 시작하는 스타일 파일명 허용 (UI, URL 등)
      ...ALLOWED_ACRONYMS.map((acronym) => `**/${acronym}*.styles.ts`),
    ],
    plugins: {
      unicorn: unicornPlugin,
    },
    rules: {
      'unicorn/filename-case': ['error', { case: 'pascalCase' }],
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
  // 설정 파일: camelCase (config 폴더)
  {
    files: ['src/**/config/**/*.ts'],
    ignores: ['**/index.ts', 'src/**/config/*.ts'],
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
  // React Query hooks 네이밍 규칙 (권장사항, 강제하지 않음)
  // Query: useFetch{Entity}{Action}Query (예: useFetchPostListQuery)
  // Mutation: use{Action}{Entity}Mutation (예: useCreatePostMutation)
  // 참고: 네이밍 규칙은 일관성을 위해 권장되지만 강제되지 않습니다.

  // Zustand Best Practice 규칙
  {
    files: ['src/**/*.{ts,tsx}'],
    rules: {
      // 1. 컴포넌트/훅 내부에서 getState() 직접 사용 금지 (구독이 안됨)
      // 대신 useStore((state) => state.value) Selector 패턴 사용
      'no-restricted-syntax': [
        'error',
        {
          // React 컴포넌트(PascalCase 함수)나 Hook(use* 함수) 내부에서 getState() 호출 감지
          selector:
            ':matches(FunctionDeclaration, FunctionExpression, ArrowFunctionExpression)[id.name=/^use|^[A-Z]/] CallExpression[callee.property.name="getState"]',
          message:
            '컴포넌트나 Hook 내부에서는 getState() 대신 useStore((state) => state.value)와 같은 Selector 패턴을 사용하세요. getState()는 상태 변경을 구독하지 않아 리렌더링되지 않습니다.',
        },
      ],
    },
  },
  // Domains 디렉토리에서 Atoms 직접 import 금지 (Elements 사용 강제)
  {
    files: [
      'src/app/**/*.tsx',
      'src/domains/**/*.tsx',
      'src/pages/**/*.tsx',
      'src/shared/ui/layouts/**/*.tsx',
      'src/shared/ui/widgets/**/*.tsx',
    ],
    ignores: ['src/pages/demo/ComponentsDemoPage.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/shared/ui/atoms/**/*'],
              message:
                'Atoms 대신 Elements를 사용하세요. (예: Button -> BaseButton, Select -> BaseSelect)',
            },
            {
              group: [
                '../**/*.ts',
                '../**/*.tsx',
                '../**/*.js',
                '../**/*.jsx',
                '../../**/*.ts',
                '../../**/*.tsx',
                '../../../**/*.ts',
                '../../../**/*.tsx',
                '..',
                '../*',
              ],
              message: '../ 대신 @/를 사용한 절대 경로 import를 사용해주세요.',
            },
          ],
        },
      ],
    },
  },
];
