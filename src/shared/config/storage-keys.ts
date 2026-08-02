/**
 * localStorage / sessionStorage 키 상수
 *
 * 앱 접두사(`linksphere:`)를 붙여 next-themes·firebase 등 같은 origin에서
 * 라이브러리가 쓰는 키(`theme` 등)와 충돌하지 않게 한다.
 *
 * 스토리지 종류(local/session)는 키 이름에 넣지 않는다 — 호출부가 이미 알고
 * 사용하고, 나중에 키가 local↔session으로 옮겨가면 접두사가 거짓말이 된다.
 */
const STORAGE_PREFIX = 'linksphere';

const STORAGE_KEYS = {
  AUTH: {
    HAS_SESSION: `${STORAGE_PREFIX}:auth:has-session`,
    SAVED_EMAIL: `${STORAGE_PREFIX}:auth:saved-email`,
  },
  SEARCH: {
    RECENT: `${STORAGE_PREFIX}:search:recent`,
  },
  FCM: {
    TOKEN: `${STORAGE_PREFIX}:fcm:token`,
  },
  THEME: `${STORAGE_PREFIX}:theme`,
} as const;

// 청크 리로드 재시도 플래그는 경로별로 1회만 허용하므로 pathname을 키에 포함
const chunkReloadKey = (pathname: string) => `${STORAGE_PREFIX}:chunk-reload:${pathname}`;

export { STORAGE_KEYS, chunkReloadKey };
