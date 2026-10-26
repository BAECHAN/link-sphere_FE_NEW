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
 * 성능 지표가 warn인 이유(총점이 아니라 결정적 지표부터 승격하는 정책)는 Civitai 선례를 따른다:
 * https://github.com/civitai/civitai/blob/main/lighthouserc.json
 * Best Practices만 error다(2026-10-26) — 통과/실패형 감사라 타이밍 지표 같은 측정 노이즈가 없고, warn이던
 * 동안 점수가 떨어져도 아무도 못 봤다. 0.9는 가중치 1짜리 감사 2개까지는 통과, 3·5짜리는 하나만 실패해도
 * 걸리는 선이다(docs/plans/2026-10-26-lighthouse-best-practices.md). lighthouse job은 필수 체크가 아니라
 * 실패해도 병합은 막히지 않는다.
 * Best Practices만 5회 중 가장 좋은 실행으로 판정한다(optimistic, LHCI 기본값이자 recommended 프리셋의
 * 방식). median-run은 FCP·TTI가 중간인 실행 하나를 골라 그 실행의 점수를 쓰는데(@lhci/utils
 * representative-runs.js), 간헐적인 콘솔 에러가 그 실행에 걸리느냐에 따라 /post가 0.93↔0.96으로
 * 갈렸다(2026-10-26 PR #416 run). 5회 내내 나는 문제는 여전히 잡힌다.
 *
 * `/post/:id`(게시글 상세)는 애초 계획에 있었지만, 존재가 보장된 고정 게시글이 없어 한 번
 * 뺐었다(PR #195 "계획 대비 구현" 참고) — 2026-09-26 tester_new_999 계정으로 공개 게시글을
 * 하나 등록해(id 06ec0958-a33c-4c3f-81f6-0481badbbeb7) 해소했다. 지우지 않는다.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm preview --port 4173 --strictPort',
      // vite preview의 출력("➜ Local: http://...")은 LHCI 기본 패턴(/listen|ready/i)과
      // 안 맞아 매번 "서버 시작 대기 타임아웃" 경고가 뜬다(2026-09-26 실행에서 직접 확인).
      // 실제로는 기다렸다 통과하긴 하지만, 정확한 패턴을 줘서 그 경고와 불필요한 대기를 없앤다.
      // 'Local:'이 아니라 'Local'인 이유: CI에서는 picocolors가 env.CI를 보고 색을 켜서 vite가
      // bold("Local") 뒤에 ANSI 코드를 넣어 "Local"과 ":"가 떨어진다 — 'Local:'로는 CI에서 계속
      // 타임아웃 경고가 났다(2026-10-25 ci.yml run 로그, vite 6.4.1).
      startServerReadyPattern: 'Local',
      url: [
        'http://localhost:4173/post',
        'http://localhost:4173/post/06ec0958-a33c-4c3f-81f6-0481badbbeb7',
        'http://localhost:4173/auth/login',
        'http://localhost:4173/auth/sign-up',
      ],
      numberOfRuns: 5,
      settings: {
        preset: 'desktop',
        // CloudWatch RUM 전송만 막는다. RUM 허용 도메인에 localhost가 없어 CI에서는 전송이 400으로
        // 거절되고, 그 콘솔 에러가 Best Practices를 깎았다(2026-10-26 PR #416 run, 5회 중 3회).
        // 차단된 요청의 메시지는 errors-in-console이 기본으로 무시한다(lighthouse 12.6.1
        // errors-in-console.js의 ERR_BLOCKED_BY_CLIENT.Inspector). 스크립트(cwr.js)는 막지 않는다 —
        // 실제 사용자도 받는 비용이라 막으면 성능 점수가 실제보다 좋게 나온다.
        blockedUrlPatterns: ['*://dataplane.rum.ap-northeast-1.amazonaws.com/*'],
      },
    },
    assert: {
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.5 }],
        'categories:best-practices': ['error', { minScore: 0.9, aggregationMethod: 'optimistic' }],
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
