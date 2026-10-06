import { z } from 'zod';

/**
 * BE 페이지네이션 요청 스키마 — BE API 요청 바디/파라미터용으로 page가 0부터 시작하는
 * API 관례를 따른다.
 */
export const paginationRequestSchema = z.object({
  page: z.number().int().nonnegative().default(0),
  size: z.number().int().positive().default(10),
});

export type PaginationRequest = z.infer<typeof paginationRequestSchema>;

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
