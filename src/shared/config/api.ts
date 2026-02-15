// 개발 환경(DEV)에서는 Vite Proxy('/api')를 통해 CORS를 우회하고,

// 배포 환경에서는 환경변수(VITE_API_BASE_URL)를 직접 사용합니다.
const API_BASE_URL: string = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL as string);

/** API 경로 prefix. 엔드포인트 조합 및 외부 재사용용 */
const API_BASES = {
  account: '/account',
  auth: '/auth',
  common: '/common',
  post: '/post',
} as const;

const API_ENDPOINTS = {
  auth: {
    login: `${API_BASES.auth}/login`,
    logout: `${API_BASES.auth}/logout`,
    refresh: `${API_BASES.auth}/refresh`,
    account: `${API_BASES.auth}/account`,
  },

  post: {
    base: API_BASES.post,
  },

  common: {
    base: API_BASES.common,
    categoryOption: `${API_BASES.common}/category-option`,
  },
} as const;

export { API_BASE_URL, API_ENDPOINTS };
