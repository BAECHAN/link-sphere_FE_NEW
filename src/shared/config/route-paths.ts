const ROUTES_PATHS = {
  HOME: '/',
  POST: {
    ROOT: '/post',
    SUBMIT: '/post/submit',
  },
  // Error
  FORBIDDEN: '/403',
  NOT_FOUND: '*',
} as const;

// 인증이 필요없는 공개 경로들

export { ROUTES_PATHS };
