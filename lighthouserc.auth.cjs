/**
 * Lighthouse CI 설정 — 로그인 필요 페이지 전용.
 *
 * lighthouserc.cjs와 assertion·측정 방식은 동일하고, 대상 URL과 로그인 스크립트만 다르다.
 * 실행 전 셸에서 `export LH_TEST_PASSWORD=...`가 필요하다(scripts/lighthouse-login.js 참고).
 * `pnpm perf:lh:auth`로 실행한다.
 *
 * 계획에는 `/post/edit/:id`도 포함돼 있었지만, 테스트 계정이 소유한 고정 게시글 ID를 보장할
 * 시드 데이터가 없어 여기서는 뺐다(계획 대비 이탈 — PR 본문에 기록). `/post/:id`(비로그인
 * 공개 상세)는 lighthouserc.cjs 쪽에도 없다 — 같은 이유로, 존재가 보장된 고정 ID가 없다.
 */
module.exports = {
  ci: {
    collect: {
      startServerCommand: 'pnpm preview --port 4173 --strictPort',
      startServerReadyPattern: 'Local:', // 이유: lighthouserc.cjs 참고
      url: [
        'http://localhost:4173/post/submit',
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
