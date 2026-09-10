/**
 * src/shared/config/api.ts의 API_ENDPOINTS 중 이 e2e 목이 쓰는 값만 옮겨온다.
 * api.ts를 직접 import할 수 없다 — 모듈 최상위에서 import.meta.env.DEV를 읽는데(api.ts:4),
 * Vite/Vitest와 달리 Playwright test의 Node 기반 테스트 러너는 import.meta.env를 채워주지
 * 않아 로드 즉시 "Cannot read properties of undefined (reading 'DEV')"로 크래시한다
 * (실측: pnpm test:e2e 최초 실행 시 재현). api.ts의 경로 상수가 바뀌면 이 파일도
 * 같이 갱신해야 한다.
 */
export const ENDPOINTS = {
  auth: {
    login: '/auth/login',
    refresh: '/auth/refresh',
    account: '/auth/account',
  },
  common: {
    categoryOption: '/common/category-option',
  },
  post: {
    base: '/post',
  },
  bookmark: {
    folders: '/bookmark/folders',
    postFolder: (postId: string, folderId: string) => `/bookmark/${postId}/folders/${folderId}`,
  },
} as const;
