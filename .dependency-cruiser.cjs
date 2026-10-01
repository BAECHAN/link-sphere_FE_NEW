/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  options: {
    // `@/` 별칭(tsconfig.app.json의 paths)을 풀기 위해 필요하다.
    tsConfig: { fileName: 'tsconfig.app.json' },
    // 기본값(false)은 컴파일 후 사라지는 `import type`을 의존성으로 보지 않는다.
    tsPreCompilationDeps: true,
    // npm 패키지는 결과에 남기되 그 안으로 더 따라가지 않는다. includeOnly로 src만 남기면
    // npm 모듈이 결과에서 통째로 빠진다.
    doNotFollow: { path: 'node_modules' },
  },
};
