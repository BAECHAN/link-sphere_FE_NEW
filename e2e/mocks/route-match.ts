/**
 * URL의 pathname이 `/api` + endpoint와 정확히 같은지 확인한다. glob 문자열
 * (`**\/api${endpoint}`) 대신 쓰는 이유 — Vite 자체 모듈 경로(예:
 * src/entities/post/api/post.keys.ts)에도 '/api/'가 부분 문자열로 들어있어, glob
 * 캐치올이 실제 API 요청이 아닌 모듈 로딩까지 막아 앱이 통째로 렌더 실패했다(2026-09-10
 * 실측 — post.keys.ts·account.keys.ts가 net::ERR_FAILED로 막혀 흰 화면만 떴다).
 * pathname 정확 일치는 이 문제에서 자유롭다.
 */
export function isApiPath(url: URL, endpoint: string): boolean {
  return url.pathname === `/api${endpoint}`;
}
