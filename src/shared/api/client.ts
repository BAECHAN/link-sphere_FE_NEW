import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { ApiError, ApiResponse, ApiErrorResponse } from '@/shared/types/common.type';
import { useAuthStore } from '@/shared/store/auth.store';

import { FormUtil } from '@/shared/utils/form.util';
import { AuthUtil } from '@/shared/utils/auth.util';
import { DateUtil } from '@/shared/utils/date.util';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { toast } from 'sonner';
import { LoginResponse } from '@/shared/types/auth.type';

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
  private refreshSubscribers: Array<(token: string) => void> = [];

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private subscribeTokenRefresh(cb: (token: string) => void) {
    this.refreshSubscribers.push(cb);
  }

  private notifySubscribers(token: string) {
    this.refreshSubscribers.forEach((cb) => cb(token));
    this.refreshSubscribers = [];
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};
    const accessToken = useAuthStore.getState().accessToken;

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
  }

  private isAuthEndpoint(endpoint: string): boolean {
    // 토큰이 만료되어도 401에러가 뜨지 않고 통과되어야 하는 API 목록
    // 로그인, 회원가입, 리프레시 요청은 인증 헤더 없이 호출 가능해야 함 (혹은 리프레시는 쿠키 사용)
    const authEndpoints = [API_ENDPOINTS.auth.login, API_ENDPOINTS.auth.signup];
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
    let url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
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

    const isFormData = options?.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
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

      if (!response.ok) {
        const text = await response.text();
        let errorResponse: ApiErrorResponse;

        try {
          const parsed = JSON.parse(text) as Record<string, unknown> | null;
          // ApiErrorResponse 구조(code 있음)인지 확인
          if (parsed && typeof parsed.code === 'string') {
            errorResponse = parsed as unknown as ApiErrorResponse;
          } else {
            // 표준 포맷이 아닌 경우 (Spring Security 기본 에러 등)
            errorResponse = {
              status: response.status,
              code: String(response.status),
              message:
                typeof parsed?.message === 'string'
                  ? parsed.message
                  : typeof parsed?.error === 'string'
                    ? parsed.error
                    : text,
              timestamp: DateUtil.formatISO(new Date()),
            };
          }
        } catch {
          errorResponse = {
            status: response.status,
            code: String(response.status),
            message: text || 'Unknown Error',
            timestamp: new Date().toISOString(),
          };
        }

        // 1. 401 Unauthorized
        if (response.status === 401) {
          // 토큰 만료 처리
          if (errorResponse.code === SERVER_ERROR_CODE.TOKEN_EXPIRED) {
            if (!this.isRefreshing) {
              this.isRefreshing = true;
              try {
                const authData = await apiClient.post<LoginResponse>(API_ENDPOINTS.auth.refresh);
                if (!authData || !authData.accessToken) {
                  throw new Error(
                    `${TEXTS.messages.error.tokenRefreshFailed} ${TEXTS.messages.error.unauthorizedAccessToken}`
                  );
                }
                const { accessToken } = authData;
                useAuthStore.getState().setAuth(accessToken);
                this.notifySubscribers(accessToken);
                return this.request<T>(endpoint, options, retryCount + 1);
              } catch (error) {
                console.error(error);
                this.refreshSubscribers = [];
                AuthUtil.clearAll();
                return new Promise(() => {});
              } finally {
                this.isRefreshing = false;
              }
            } else {
              // 이미 갱신 중이라면 새 토큰 발급 완료까지 대기 후 재시도
              return new Promise<T>((resolve) => {
                this.subscribeTokenRefresh(() => {
                  resolve(this.request<T>(endpoint, options, retryCount + 1));
                });
              });
            }
          } else if (
            errorResponse.code === SERVER_ERROR_CODE.NOT_LOGGED_IN ||
            errorResponse.code === SERVER_ERROR_CODE.INVALID_TOKEN
          ) {
            toast.error(TEXTS.messages.error.loginRequired);
            AuthUtil.clearAll();
            return new Promise(() => {});
          }
        }

        // 2. 403 Forbidden
        if (response.status === 403) {
          if (
            errorResponse.code === SERVER_ERROR_CODE.ACCESS_DENIED ||
            (options?.method !== 'GET' && options?.method !== undefined)
          ) {
            toast.error(TEXTS.messages.error.accessDenied);
          }
        }

        // 3. 404 Not Found 및 기타 에러
        throw new ApiError(errorResponse);
      }

      // 204 No Content 또는 Content-Length가 0인 경우 빈 객체 반환
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
        const json = JSON.parse(text) as ApiResponse<T>;

        // ApiResponse 구조인지 확인 (status, data, message 필드가 있는지)
        // 백엔드 응답이 항상 ApiResponse로 래핑된다고 가정
        if (json && typeof json === 'object' && 'data' in json && 'status' in json) {
          return (json as ApiResponse<T>).data;
        }

        // 래핑되지 않은 날것의 데이터인 경우 (예외 케이스)
        return json as T;
      } catch {
        // JSON이 아닌 경우 텍스트 자체를 반환하거나 에러 처리
        // 여기서는 안전하게 텍스트 반환
        return text as unknown as T;
      }
    } catch (error) {
      // AbortError는 사용자가 의도적으로 취소한 것이므로 로그 출력 제외
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      console.error(TEXTS.messages.error.apiRequestFailed, error);
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: ApiRequestOptions): Promise<T> {
    return this.request<T>(endpoint, { ...options, method: 'GET' });
  }

  async post<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const isFormData = data instanceof FormData;
    const bodyData = isFormData ? data : this.processRequestData(data);

    return this.request<T>(endpoint, {
      ...options,
      method: 'POST',
      body: isFormData ? (bodyData as FormData) : JSON.stringify(bodyData),
    });
  }

  async put<T>(endpoint: string, data: unknown, options?: ApiRequestOptions): Promise<T> {
    const isFormData = data instanceof FormData;
    const bodyData = isFormData ? data : this.processRequestData(data);

    return this.request<T>(endpoint, {
      ...options,
      method: 'PUT',
      body: isFormData ? (bodyData as FormData) : JSON.stringify(bodyData),
    });
  }

  async patch<T>(endpoint: string, data: unknown, options?: ApiRequestOptions): Promise<T> {
    const isFormData = data instanceof FormData;
    const bodyData = isFormData ? data : this.processRequestData(data);

    return this.request<T>(endpoint, {
      ...options,
      method: 'PATCH',
      body: isFormData ? (bodyData as FormData) : JSON.stringify(bodyData),
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
