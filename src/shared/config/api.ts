// 개발 환경(DEV)에서는 Vite Proxy('/api')를 통해 CORS를 우회하고,

// 배포 환경에서는 환경변수(VITE_API_BASE_URL)를 직접 사용합니다.
const API_BASE_URL: string = import.meta.env.DEV
  ? '/api'
  : (import.meta.env.VITE_API_BASE_URL ?? '/api');

/** API 경로 prefix. 엔드포인트 조합 및 외부 재사용용 */
const API_BASES = {
  account: '/account',
  auth: '/auth',
  common: '/common',
  post: '/post',
  comment: '/comment',
} as const;

const API_ENDPOINTS = {
  auth: {
    login: `${API_BASES.auth}/login`,
    logout: `${API_BASES.auth}/logout`,
    refresh: `${API_BASES.auth}/refresh`,
    account: `${API_BASES.auth}/account`,
    updateAccount: `${API_BASES.auth}/account`,
    uploadAvatar: `${API_BASES.auth}/account/avatar`,
    signup: `${API_BASES.auth}/signup`,
  },

  post: {
    base: API_BASES.post,
    togglePostLike: (postId: string) => `${API_BASES.post}/${postId}/like`,
    toggleCommentLike: (commentId: string) => `${API_BASES.comment}/${commentId}/like`,

    postBookmark: (postId: string) => `${API_BASES.post}/${postId}/bookmark`,

    postComment: (postId: string) => `${API_BASES.post}/${postId}/comment`,
    comment: (commentId: string) => `${API_BASES.comment}/${commentId}`,
    commentReply: (commentId: string) => `${API_BASES.comment}/${commentId}/reply`,
  },

  common: {
    base: API_BASES.common,
    categoryOption: `${API_BASES.common}/category-option`,
  },
} as const;

export { API_BASE_URL, API_ENDPOINTS };
