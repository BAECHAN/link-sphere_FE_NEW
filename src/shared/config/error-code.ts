export const SERVER_ERROR_CODE = {
  // Auth
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  NOT_LOGGED_IN: 'NOT_LOGGED_IN',
  ACCESS_DENIED: 'ACCESS_DENIED',
  MISSING_REFRESH_TOKEN: 'MISSING_REFRESH_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  // 비밀번호 변경·회원 탈퇴 시 현재 비밀번호 재확인 실패(BE InvalidCredentialsException)
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  // 비밀번호재설정·이메일인증 토큰 전용(위 INVALID_REFRESH_TOKEN과 별개 - BE
  // InvalidActionTokenException 참고)
  INVALID_ACTION_TOKEN: 'INVALID_ACTION_TOKEN',
  DUPLICATE_NICKNAME: 'DUPLICATE_NICKNAME',
  // 이메일 미인증 상태에서 글쓰기·댓글쓰기 시도(BE EmailNotVerifiedException) - FE도
  // 제출 전에 emailVerified를 먼저 확인해 막지만, 그 사이 인증 상태가 바뀌는 등의
  // 경우를 대비한 서버 쪽 방어 계층 중복
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',

  // Post 등록·수정·미리보기 - URL 검증 실패 원인(BE SafeUrlValidator, 2026-10-03 분리)
  INVALID_URL: 'INVALID_URL',
  URL_UNRESOLVABLE: 'URL_UNRESOLVABLE',
  URL_NOT_ALLOWED: 'URL_NOT_ALLOWED',
  // URL 코드 분리 이전 BE가 보내던 코드 - 배포 순서가 어긋난 경우에 대비해 같은 안내로 받는다
  INVALID_INPUT: 'INVALID_INPUT',
  FOLDER_NOT_FOUND: 'FOLDER_NOT_FOUND',
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  FORBIDDEN: 'FORBIDDEN',

  // Common
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  // CloudFront/WAF가 앱에 닿기 전에 막은 요청 (403 + 비-JSON HTML 응답)
  EDGE_BLOCKED: 'EDGE_BLOCKED',
} as const;
