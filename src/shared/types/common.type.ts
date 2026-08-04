import {
  FieldErrors,
  FieldValues,
  SubmitHandler,
  UseFormHandleSubmit,
  UseFormRegister,
  UseFormReset,
  UseFormReturn,
  UseFormSetValue,
  UseFormWatch,
} from 'react-hook-form';
import { z } from 'zod';

export type ResultType<T> = { ok: true; value: T } | { ok: false; error: Error };

export type PageType = {
  page: number;
  size: number;
  totalPages: number;
  totalCount: number;
};

export type ResponseType<T> = {
  data: T | null;
  page?: PageType;
};

/**
 * 페이지네이션 공통 스키마
 * URL 쿼리 스트링 처리를 위해 z.coerce 사용
 */
export const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  size: z.coerce.number().min(1).default(10),
  sort: z.string().optional(),
});

/**
 * 날짜 범위 검색 공통 스키마
 */
export const dateRangeSchema = z.object({
  fromDate: z.string().optional(), // 필요시 .regex()로 날짜 형식 검증 추가
  toDate: z.string().optional(),
});

export const commonSearchRequestSchema = paginationSchema.merge(dateRangeSchema).extend({
  keyword: z.string().optional(),
});

export type CommonSearchRequest = z.infer<typeof commonSearchRequestSchema>;

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

export type CodeType<T extends string | number> = {
  code: T;
  codeName: string;
};

export type FormType = {
  register: UseFormRegister<any>;
  errors: FieldErrors<any>;
  handleSubmit: UseFormHandleSubmit<any>;
  onSubmit: SubmitHandler<any>;
  reset: UseFormReset<any>;
  setValue: UseFormSetValue<any>;
  watch: UseFormWatch<any>;
};

export type SearchPropsType<T extends FieldValues> = {
  form: UseFormReturn<T>;
  onSearch: (e: React.FormEvent<HTMLFormElement>) => void;
  onReset: () => void;
  isFetching?: boolean;
};
