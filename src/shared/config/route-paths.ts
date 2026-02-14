const ROUTES_BASE = {
  POST: '/post',
  AUTH: '/auth',
};

const ROUTES_PATHS = {
  HOME: '/',
  POST: {
    ROOT: ROUTES_BASE.POST,
    SUBMIT: `${ROUTES_BASE.POST}/submit`,
  },
  AUTH: {
    LOGIN: `${ROUTES_BASE.AUTH}/login`,
    REGISTER: `${ROUTES_BASE.AUTH}/register`,
  },
  // Error
  FORBIDDEN: '/403',
  NOT_FOUND: '*',
} as const;

// 인증이 필요없는 공개 경로들

export { ROUTES_PATHS };
