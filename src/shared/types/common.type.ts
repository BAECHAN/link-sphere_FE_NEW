/**
 * BE 페이지네이션 요청 — BE API 요청 바디/파라미터용으로 page가 0부터 시작하는
 * API 관례를 따른다.
 *
 * 런타임 zod 스키마로 두지 않는다 - 이 파일은 에러 클래스 때문에 첫 로딩 청크에 들어가서,
 * 쓰이지 않는 스키마 하나만으로도 zod 전체가 첫 로딩에 실렸다(2026-10-28 빌드 확인,
 * docs/PERFORMANCE.md "첫 로딩 JS").
 */
export type PaginationRequest = {
  page: number;
  size: number;
};

/**
 * Standard API Response Structure
 */
export interface ApiResponse<T> {
  status: number;
  message: string;
  data: T;
  timestamp: string;
}

/**
 * Standard API Error Structure
 * Matches Backend ErrorResponse
 */
export interface ApiErrorResponse {
  status: number;
  code: string;
  message: string;
  timestamp: string;
}

/**
 * API 에러 클래스
 */
export class ApiError extends Error {
  status: number;
  code: string;
  data: ApiErrorResponse;
  /** 429 응답의 Retry-After(초). 헤더가 없거나 초 단위가 아니면 undefined - client.ts가 채운다 */
  retryAfterSeconds?: number;

  constructor(data: ApiErrorResponse) {
    super(data.message);
    this.name = 'ApiError';
    this.status = data.status;
    this.code = data.code;
    this.data = data;
  }
}

/**
 * 클라이언트 코드가 의도적으로 던지는, 메시지를 그대로 사용자에게 보여줘도 되는 에러
 * (예: 이미지 용량 초과). 네트워크 실패 등 예상치 못한 일반 Error와 구분해, 전역 에러 핸들러가
 * 후자는 날것 그대로(영어 브라우저 메시지 등) 노출하지 않고 일반 실패 메시지로 감싸도록 한다.
 */
export class UserFacingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserFacingError';
  }
}

/**
 * 서버 응답을 받기 전에 fetch가 실패한 경우(오프라인·연결 끊김 등). fetch는 이때 TypeError로
 * reject한다([MDN](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)). 문구는
 * 브라우저가 정하므로 문구 대신 이 타입으로 판별한다. client.ts·upload.api.ts가 fetch 호출 자리에서만
 * 바꾼다 - 다른 TypeError는 코드 버그일 수 있어 그대로 둔다.
 */
export class NetworkError extends Error {
  constructor() {
    super('Network request failed');
    this.name = 'NetworkError';
  }
}

/**
 * 요청을 보낸 뒤 인증 세대가 바뀌어(다른 탭·같은 탭의 명시적 로그인·로그아웃) 처리하지 않고 끝낸 요청.
 * 그 사이 공유 refresh 쿠키가 다른 계정의 것이 됐을 수 있어 갱신·재시도하면 다른 계정으로 실행된다
 * (client.ts handleTokenExpired, docs/AUTH.md §8-B). 화면은 인증 세대 동기화(useAuthEpochSync)가 맞춘다.
 */
export class SessionChangedError extends Error {
  constructor() {
    super('Auth session changed while the request was in flight');
    this.name = 'SessionChangedError';
  }
}

/**
 * 이 탭의 로그인이 만료돼(refresh가 거절됨) 처리하지 못하고 끝낸 요청. 만료 정리(AuthUtil)가 화면과 안내를
 * 맡으므로 이 에러를 받은 쪽은 실패 토스트를 띄우지 않는다(client.ts handleTokenExpired, docs/AUTH.md §8-B).
 * refresh를 기다리던 요청도 같은 에러로 끝난다 - 끝나지 않는 채로 두면 화면에 남은 폼이 "저장 중"에 멈춘다.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super('Auth session expired before the request could be processed');
    this.name = 'SessionExpiredError';
  }
}

/**
 * 이미지 업로드 단계(서명 URL 발급 → 스토리지 PUT)에서 실패한 원인.
 * - unsupportedType·tooLarge: 그 이미지를 바꾸면 해결된다
 * - rateLimited: 우리 서버의 업로드 한도(시간당 30회). retryAfterSeconds가 함께 온다
 * - storageUnavailable: 스토리지 혼잡(429)·장애(5xx)
 * - failed: 원인을 특정하지 못했다
 */
export type ImageUploadFailureReason =
  | 'unsupportedType'
  | 'tooLarge'
  | 'rateLimited'
  | 'storageUnavailable'
  | 'network'
  | 'failed';

/**
 * 이미지 업로드 단계의 실패. 본 요청(댓글 등록 등)을 보내기 전이라 그 글은 저장되지 않았다 - 같은
 * 429·네트워크 실패라도 본 요청의 실패와 안내가 달라 타입으로 구분한다. 원인은
 * shared/lib/upload/uploadImageAndGetUrl.ts와 upload.api.ts가 판정한다.
 */
export class ImageUploadError extends Error {
  reason: ImageUploadFailureReason;
  /** reason이 rateLimited일 때 서버가 준 Retry-After(초) */
  retryAfterSeconds?: number;

  constructor(reason: ImageUploadFailureReason, retryAfterSeconds?: number) {
    super(`Image upload failed: ${reason}`);
    this.name = 'ImageUploadError';
    this.reason = reason;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export type SelectOptionType<T = unknown> = {
  label: string;
  value: string;
} & T;
