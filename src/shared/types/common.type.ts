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
 * 공통 API 응답 타입
 */
export interface ApiResponse<T = unknown> {
  code: number;
  message: string;
  data: T;
}

export interface ApiResponseWithPage<T = unknown> extends ApiResponse<T> {
  page: PageType;
}

export interface ApiErrorResponse {
  code: number;
  message: string;
  error: string;
}

/**
 * API 에러 응답 타입
 */
export interface ApiErrorHTTPResponse {
  status: number;
  statusText: string;
  data: ApiErrorResponse;
}

/**
 * API 에러 클래스
 */
export class ApiError extends Error implements ApiErrorHTTPResponse {
  status: number;
  statusText: string;
  data: ApiErrorResponse;

  constructor(status: number, statusText: string, data: ApiErrorResponse) {
    super(`${status} ${statusText}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.data = data;
  }
}

export type SelectOptionType<T = unknown> = {
  label: string;
  value: string;
} & T;

export type CodeType<T extends string | number> = {
  code: T;
  codeName: string;
  subCode?: T;
};

export type CodeTypeResponse<T extends string | number> = ApiResponse<CodeType<T>[]>;

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
