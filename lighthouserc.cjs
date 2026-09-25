/**
 * Lighthouse CI 설정 — 공개 페이지 전용.
 *
 * 로컬(`pnpm perf:lh`)과 GitHub Actions CI(`ci.yml`)가 이 설정을 그대로 공유한다.
 * `startServerCommand`로 이 브랜치의 빌드 결과물을 직접 서빙해 측정하므로, 배포와 무관하게
 * "지금 이 코드가 얼마나 느려졌는지"를 알 수 있다. 프로덕션 자체를 재는 건 별도 문서
 * (docs/PERFORMANCE.md의 "프로덕션 재측정" 절)를 참고한다.
 *
 * 5회 측정 후 중앙값을 쓰는 이유:
 * "5회 실행의 중앙값 점수가 1회보다 2배 안정적이다" (번역)
 * https://github.com/GoogleChrome/lighthouse/blob/main/docs/variability.md
 *
 * 전부 warn인 이유(총점이 아니라 결정적 지표부터 승격하는 정책)는 Civitai 선례를 따른다:
 * https://github.com/civitai/civitai/blob/main/lighthouserc.json
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm preview --port 4173 --strictPort',
      // vite preview의 출력("➜ Local: http://...")은 LHCI 기본 패턴(/listen|ready/i)과
      // 안 맞아 매번 "서버 시작 대기 타임아웃" 경고가 뜬다(2026-09-26 실행에서 직접 확인).
      // 실제로는 기다렸다 통과하긴 하지만, 정확한 패턴을 줘서 그 경고와 불필요한 대기를 없앤다.
      startServerReadyPattern: 'Local:',
      url: [
        'http://localhost:4173/post',
        'http://localhost:4173/auth/login',
        'http://localhost:4173/auth/sign-up',
      ],
      numberOfRuns: 5,
      settings: {
        preset: 'desktop',
      },
    },
    assert: {
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.5 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
        'resource-summary:script:size': ['warn', { maxNumericValue: 400000 }],
        'resource-summary:font:size': ['warn', { maxNumericValue: 500000 }],
        'resource-summary:image:size': ['warn', { maxNumericValue: 1000000 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
