import { API_BASE_URL } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { ApiError, ApiErrorResponse } from '@/shared/types/common.type';

import { FormUtil } from '@/shared/utils/form.util';

interface ApiRequestOptions extends RequestInit {
  searchParams?: Record<string, any>;
  responseType?: 'json' | 'blob' | 'text';
}

/**
 * API 클라이언트 - fetch 기반
 */
class ApiClient {
  private baseURL: string;
  private isRefreshing = false;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    return headers;
  }

  private isAuthEndpoint(endpoint: string): boolean {
    // 토큰이 만료되어도 401에러가 뜨지 않고 통과되어야 하는 API 목록
    // 로그인 API는 인증 없이 호출 가능해야 함
    const authEndpoints = ['/auth/login'];
    return authEndpoints.some((path) => endpoint.includes(path));
  }

  /**
   * 데이터 전처리 (NFC 정규화 -> 빈 문자열 null 처리)
   */
  private processRequestData(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    // 1. 모든 문자열 NFC 정규화 (Mac/Window 한글 호환)
    const normalizedData = FormUtil.normalizePayload(data);

    // 2. 빈 문자열("")을 null로 변환 (기존 로직 유지)
    // normalizePayload가 객체를 리턴하므로 타입 단언이 안전함
    if (normalizedData && typeof normalizedData === 'object' && !Array.isArray(normalizedData)) {
      return FormUtil.emptyStringToNullInObject(normalizedData as Record<string, unknown>);
    }

    return normalizedData;
  }

  private async request<T>(
    endpoint: string,
    options?: ApiRequestOptions,
    retryCount = 0
  ): Promise<T> {
    let url = `${this.baseURL}${endpoint}`;
    const isAuth = this.isAuthEndpoint(endpoint);

    // 쿼리 파라미터 처리
    if (options?.searchParams) {
      const searchParams = new URLSearchParams();
      Object.entries(options.searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          // 쿼리 파라미터도 한글이 들어갈 수 있으니 안전하게 NFC 처리
          const stringValue = String(value).normalize('NFC');
          searchParams.append(key, stringValue);
        }
      });
      const queryString = searchParams.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.getAuthHeaders(),
      ...((options?.headers as Record<string, string>) || {}),
    };

    // 인증이 필요없는 엔드포인트에서는 Authorization 헤더 제거
    if (isAuth && headers.Authorization) {
      delete headers.Authorization;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // 쿠키 전송을 위해 필요 (필요 시)
      });

      // 498 에러 처리 (accessToken 만료) - 인증 필요 경로에서만 처리
      // 401 에러도 토큰 만료로 처리하는 경우가 많으므로 확인 필요하지만 일단 기존 로직(498) 유지
      if (response.status === 498 && !isAuth && retryCount === 0) {
        // 토큰 갱신 시도
        if (!this.isRefreshing) {
          this.isRefreshing = true;

          return this.request<T>(endpoint, options, retryCount + 1);
        } else {
          // 이미 갱신 중이면 잠시 대기 후 재시도
          await new Promise((resolve) => setTimeout(resolve, 100));
          return this.request<T>(endpoint, options, retryCount + 1);
        }
      }

      // 리프레시 토큰 API 호출에서 401/403 에러 발생 시 즉시 로그아웃 처리
      if (endpoint.includes('/auth/refresh-token') && response.status === 401) {
        console.error(`${TEXTS.messages.error.unauthorizedRefreshToken} 로그아웃 처리합니다.`);
        throw new Error(TEXTS.messages.error.unauthorizedRefreshToken);
      }

      // 403 Forbidden 처리 (UX 개선)
      if (response.status === 403) {
        return Promise.reject(new Error('Forbidden'));
      }
      if (!response.ok) {
        const errorResponseBody = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        throw new ApiError(response.status, response.statusText, errorResponseBody);
      }

      if (response.status === 204 || response.headers.get('content-length') === '0') {
        return {} as T;
      }

      if (options?.responseType === 'blob') {
        return (await response.blob()) as T;
      }

      const text = await response.text();
      if (!text) {
        return {} as T;
      }

      if (options?.responseType === 'text') {
        return text as T;
      }

      try {
        const data = JSON.parse(text) as T;
        return data;
      } catch {
        return text as unknown as T;
      }
    } catch (error) {
      console.error(TEXTS.messages.error.apiRequestFailed, error);
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data: unknown, options?: ApiRequestOptions): Promise<T> {
    const bodyData = this.processRequestData(data);

    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(bodyData),
    });
  }

  async put<T>(endpoint: string, data: unknown, options?: ApiRequestOptions): Promise<T> {
    const bodyData = this.processRequestData(data);

    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(bodyData),
    });
  }

  async patch<T>(endpoint: string, data: unknown, options?: ApiRequestOptions): Promise<T> {
    const bodyData = this.processRequestData(data);

    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(bodyData),
    });
  }

  async delete<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'DELETE' });
  }

  /**
   * 파일 다운로드 요청 (Blob 반환)
   */
  async download(endpoint: string, options?: ApiRequestOptions): Promise<Blob> {
    return this.request<Blob>(endpoint, {
      ...options,
      method: options?.method || 'GET',
      responseType: 'blob',
    });
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
