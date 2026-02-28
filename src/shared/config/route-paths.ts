const ROUTES_BASE = {
  POST: '/post',
  AUTH: '/auth',
};

const ROUTES_PATHS = {
  HOME: '/',
  POST: {
    ROOT: ROUTES_BASE.POST,
    SUBMIT: `${ROUTES_BASE.POST}/submit`,
    EDIT: `${ROUTES_BASE.POST}/edit/:id`,
  },
  AUTH: {
    LOGIN: `${ROUTES_BASE.AUTH}/login`,
    SIGNUP: `${ROUTES_BASE.AUTH}/sign-up`,
  },
  // Error
  FORBIDDEN: '/403',
  NOT_FOUND: '*',
} as const;

// 인증이 필요없는 공개 경로들
const PUBLIC_PATHS = [ROUTES_PATHS.AUTH.LOGIN, ROUTES_PATHS.AUTH.SIGNUP] as const;

export { ROUTES_PATHS, PUBLIC_PATHS };
