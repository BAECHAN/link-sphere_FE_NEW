// 개발 환경(DEV)에서는 Vite Proxy('/api')를 통해 CORS를 우회하고,

// 배포 환경에서는 환경변수(VITE_API_BASE_URL)를 직접 사용합니다.
const API_BASE_URL: string = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL as string);

const API_ENDPOINTS = {
  auth: {
    login: '/auth/login',
    logout: '/auth/logout',
    refreshToken: '/auth/refresh-token',
  },

  common: {
    base: '/common',
  },
} as const;

export { API_BASE_URL, API_ENDPOINTS };
