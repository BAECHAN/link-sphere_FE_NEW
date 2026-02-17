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
