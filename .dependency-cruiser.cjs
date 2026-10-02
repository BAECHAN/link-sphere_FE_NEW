/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  // ESLint가 이미 강제하는 것(레이어 하향 의존, 순환 참조)은 여기 두지 않는다 — ESLint로
  // 표현하기 어렵거나 아무것도 막지 않던 빈칸만 맡긴다(docs/plans/2026-10-01-dependency-cruiser.md).
  forbidden: [
    {
      name: 'entities-cross-import-only-via-x',
      comment:
        '다른 entity는 그 entity의 @x/ 공개 표면으로만 import한다 (docs/FE-ARCHITECTURE.md §5). ' +
        '새 교차 참조가 필요하면 상대 entity에 @x/<내 entity>.ts를 만들어 거기서 다시 내보낸다.',
      severity: 'error',
      // bookmark/folder처럼 그룹 폴더 아래 슬라이스도 한 슬라이스로 본다. 테스트는 다른 entity의
      // raw keys를 일부러 가져다 쓰므로 제외한다.
      from: { path: '^src/entities/(bookmark/[^/]+|[^/]+)/', pathNot: '[.]test[.]tsx?$' },
      to: {
        path: '^src/entities/',
        pathNot: ['^src/entities/$1/', '^src/entities/(bookmark/[^/]+|[^/]+)/@x/'],
      },
    },
    {
      name: 'features-widgets-no-cross-slice-import',
      comment:
        'features·widgets 슬라이스는 같은 레이어의 다른 슬라이스를 import하지 않는다 ' +
        '(docs/FE-ARCHITECTURE.md §26). 다른 슬라이스의 UI를 그려야 하면 render<대상> 함수 prop을 받고 ' +
        '위층(pages·app, features 입장에선 widgets)이 넘긴다.',
      severity: 'error',
      // 슬라이스는 항상 <도메인 그룹>/<슬라이스> 두 단계다(features/post/create, widgets/post/post-card) —
      // 그룹 폴더 자체에는 파일이 없다(§1 "슬라이스 그룹 폴더" 행). $1은 레이어, $2는 자기 슬라이스.
      // 테스트는 실제 앱처럼 위층 역할을 대신해 다른 슬라이스의 UI를 직접 넘기므로 제외한다.
      from: { path: '^src/(features|widgets)/([^/]+/[^/]+)/', pathNot: '[.]test[.]tsx?$' },
      to: {
        path: '^src/$1/',
        pathNot: '^src/$1/$2/',
      },
    },
    {
      name: 'no-non-package-json',
      comment:
        'package.json에 없는 패키지는 import하지 않는다 — .npmrc가 shamefully-hoist=true라 ' +
        '다른 패키지의 하위 의존성이 끌어올려져 pnpm이 막지 못한다.',
      severity: 'error',
      from: {},
      to: { dependencyTypes: ['npm-no-pkg', 'npm-unknown'] },
    },
    {
      name: 'not-to-unresolvable',
      comment:
        '디스크에서 찾을 수 없는 모듈은 import하지 않는다. 해석에 실패한 import는 유형이 unknown이 돼 ' +
        'no-non-package-json 판정을 조용히 건너뛰므로(2026-10-01 프로브로 확인), 해석 실패 자체를 막는다. ' +
        'npm 패키지면 package.json에 추가하고, 경로라면 오타나 삭제된 파일인지 확인한다.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'not-to-dev-dep',
      comment:
        'production 코드는 devDependency를 import하지 않는다 — 개발용 패키지(msw 등)가 런타임 ' +
        '코드로 새는 것을 막는다.',
      severity: 'error',
      from: {
        path: '^src/',
        pathNot: [
          '[.](test|stories)[.]tsx?$',
          '^src/(test|mocks)/',
          // 선언 파일은 런타임 코드를 만들지 않는다(vite-env.d.ts의 vite/client 타입 참조 등)
          '[.]d[.]ts$',
          // devtools는 NODE_ENV=development일 때만 번들에 포함된다
          // (https://tanstack.com/query/latest/docs/framework/react/devtools)
          '^src/app/providers/QueryProvider[.]tsx$',
        ],
      },
      to: { dependencyTypes: ['npm-dev'] },
    },
  ],
  options: {
    // `@/` 별칭(tsconfig.app.json의 paths)을 풀기 위해 필요하다.
    tsConfig: { fileName: 'tsconfig.app.json' },
    // 기본값(false)은 컴파일 후 사라지는 `import type`을 의존성으로 보지 않는다.
    tsPreCompilationDeps: true,
    // npm 패키지는 결과에 남기되 그 안으로 더 따라가지 않는다. includeOnly로 src만 남기면
    // npm 모듈이 결과에서 통째로 빠진다.
    doNotFollow: { path: 'node_modules' },
    // package.json의 exports 조건으로만 진입점을 내놓는 ESM 패키지(Storybook 10 등)를 풀기 위한
    // 설정이다. 없으면 이런 import가 "해석 실패(unknown)"로 처리돼 no-non-package-json 판정을
    // 조용히 건너뛴다(2026-10-01 프로브로 확인). 값은 dependency-cruiser `--init` 템플릿 그대로다.
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      mainFields: ['module', 'main', 'types', 'typings'],
    },
  },
};
