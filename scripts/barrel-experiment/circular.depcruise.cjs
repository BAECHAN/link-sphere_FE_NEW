// 배럴 비용 비교 실험의 순환 의존 집계(docs/PERFORMANCE.md "배럴 비교"). 런타임 순환만 센다 - 타입 import와 테스트·목은 빠진다.
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'error',
      from: { pathNot: '\\.(test|stories)\\.tsx?$' },
      to: { circular: true, pathNot: '\\.(test|stories)\\.tsx?$' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '\\.(test|stories)\\.tsx?$|^src/test/|^src/mocks/' },
    tsPreCompilationDeps: false,
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: { extensions: ['.ts', '.tsx', '.js', '.json'] },
  },
};
