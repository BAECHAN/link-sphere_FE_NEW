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

export type SelectOptionType<T = unknown> = {
  label: string;
  value: string;
} & T;
