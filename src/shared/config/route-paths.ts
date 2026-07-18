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
  BOOKMARK: '/bookmark',
  // Error
  FORBIDDEN: '/403',
  SERVER_ERROR: '/500',
  NOT_FOUND: '*',
} as const;

// 인증이 필요없는 공개 경로들
const PUBLIC_PATHS = [ROUTES_PATHS.AUTH.LOGIN, ROUTES_PATHS.AUTH.SIGNUP] as const;

// 로그인이 필요한(ProtectedRoute로 감싸진) 경로인지 판별
const isProtectedPath = (pathname: string): boolean => {
  const editPrefix = ROUTES_PATHS.POST.EDIT.replace('/:id', ''); // '/post/edit'
  return (
    pathname.startsWith(ROUTES_PATHS.POST.SUBMIT) ||
    pathname.startsWith(editPrefix) ||
    pathname.startsWith(ROUTES_PATHS.BOOKMARK)
  );
};

export { ROUTES_PATHS, PUBLIC_PATHS, isProtectedPath };
