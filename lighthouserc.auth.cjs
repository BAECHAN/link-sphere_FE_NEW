/**
 * Lighthouse CI 설정 — 로그인 필요 페이지 전용.
 *
 * lighthouserc.cjs와 assertion·측정 방식은 동일하고, 대상 URL과 로그인 스크립트만 다르다.
 * 실행 전 셸에서 `export LH_TEST_PASSWORD=...`가 필요하다(scripts/lighthouse-login.js 참고).
 * `pnpm perf:lh:auth`로 실행한다.
 *
 * `/post/edit/:id`는 애초 계획에 있었지만, 테스트 계정이 소유한 고정 게시글이 없어 한 번
 * 뺐었다(PR #195 "계획 대비 구현" 참고) — 2026-09-26 tester_new_999 계정으로 게시글을
 * 하나 등록해(https://www.inflearn.com/, id 06ec0958-a33c-4c3f-81f6-0481badbbeb7, 공개)
 * 해소했다. 이 게시글은 측정용으로만 쓰고 삭제하지 않는다 — 지우면 이 설정이 다시 깨진다.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm preview --port 4173 --strictPort',
      startServerReadyPattern: 'Local:', // 이유: lighthouserc.cjs 참고
      url: [
        'http://localhost:4173/post/submit',
        'http://localhost:4173/post/edit/06ec0958-a33c-4c3f-81f6-0481badbbeb7',
        'http://localhost:4173/bookmark',
        'http://localhost:4173/my/comments',
      ],
      numberOfRuns: 5,
      settings: {
        preset: 'desktop',
        // 로그인 세션(httpOnly 쿠키 + has-session 플래그)이 URL마다 리셋되지 않도록 유지한다.
        disableStorageReset: true,
        puppeteerScript: './scripts/lighthouse-login.js',
      },
    },
    assert: {
      aggregationMethod: 'median-run',
      assertions: {
        'categories:performance': ['warn', { minScore: 0.5 }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 4000 }],
        'total-blocking-time': ['warn', { maxNumericValue: 600 }],
        'cumulative-layout-shift': ['warn', { maxNumericValue: 0.1 }],
      },
    },
    upload: {
      target: 'temporary-public-storage',
    },
  },
};
