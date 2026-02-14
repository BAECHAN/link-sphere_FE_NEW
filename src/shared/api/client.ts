import { API_BASE_URL } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { ApiError, ApiErrorResponse } from '@/shared/types/common.type';
import { useAuthStore } from '@/domains/auth/_common/model/auth.store';
import { authApi } from '@/domains/auth/_common/api/auth.api';

import { FormUtil } from '@/shared/utils/form.util';
import { AuthUtil } from '@/domains/auth/_common/utils/auth.util';

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
    const accessToken = useAuthStore.getState().accessToken;

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    return headers;
  }

  private isAuthEndpoint(endpoint: string): boolean {
    // 토큰이 만료되어도 401에러가 뜨지 않고 통과되어야 하는 API 목록
    // 로그인, 회원가입, 리프레시 요청은 인증 헤더 없이 호출 가능해야 함 (혹은 리프레시는 쿠키 사용)
    const authEndpoints = ['/auth/login', '/auth/signup', '/auth/refresh'];
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

      // 401 에러 처리 (accessToken 만료) - 인증 필요 경로에서만 처리

      if (response.status === 401) {
        // 최초 실패 시 토큰 갱신 시도
        if (retryCount === 0) {
          // 토큰 갱신 시도
          if (!this.isRefreshing) {
            this.isRefreshing = true;
            try {
              const authData = await authApi.refresh();

              if (!authData || !authData.accessToken) {
                throw new Error(
                  `${TEXTS.messages.error.tokenRefreshFailed} ${TEXTS.messages.error.unauthorizedAccessToken}`
                );
              }

              const { accessToken } = authData;

              // 새 토큰으로 상태 업데이트
              useAuthStore.getState().setAuth(accessToken);

              // 원래 요청 재시도
              return this.request<T>(endpoint, options, retryCount + 1);
            } catch (error) {
              // 갱신 실패 시 로그아웃
              AuthUtil.clearAll();
              throw error;
            } finally {
              this.isRefreshing = false;
            }
          } else {
            // 이미 갱신 중이면 잠시 대기 후 재시도
            await new Promise((resolve) => setTimeout(resolve, 100));
            return this.request<T>(endpoint, options, retryCount + 1);
          }
        } else {
          AuthUtil.clearAll();
          // 최초 실패 이후 토큰 갱신 실패 시 에러 발생
          throw new Error(
            `${TEXTS.messages.error.tokenRefreshFailed} ${TEXTS.messages.error.unauthorizedRefreshToken}`
          );
        }
      }

      // 403 Forbidden 처리 (UX 개선)
      if (response.status === 403) {
        // GET 요청(페이지 로드성)이 아닌 경우 (Action) -> Alert 표시
        if (options?.method !== 'GET' && options?.method !== undefined) {
          // useAlertStore.getState().openAlert({
          //   title: '권한 없음',
          //   message: '해당 작업을 수행할 권한이 없습니다.',
          // });
        }
        // GET 요청은 ErrorBoundary가 처리하도록 에러 전파
        return Promise.reject(new Error('Forbidden'));
      }

      // 404 Not Found 처리
      if (response.status === 404) {
        // 404도 리다이렉트보다는 에러 전파가 나을 수 있음 (부분 데이터 로딩 실패 등)
        // 하지만 기존 요구사항(이전 대화)에서 404 리다이렉트를 원했으므로 유지하되,
        // API 호출 실패가 전체 페이지 404로 이어지는게 맞는지 고민 필요.
        // 일단 403 UX 개선에 집중하기 위해 404는 기존 로직(리다이렉트) 유지하거나,
        // 403과 동일하게 처리할 수 있음. 여기서는 403과 동일하게 처리하도록 변경 (일관성)
        // window.location.href = '/404';
        return Promise.reject(new Error('Not Found'));
      }

      if (!response.ok) {
        // response.json()의 반환 타입을 unknown으로 처리하여 타입 안전성 확보
        const errorResponseBody = (await response.json().catch(() => ({}))) as ApiErrorResponse;
        throw new ApiError(response.status, response.statusText, errorResponseBody);
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
        const data = JSON.parse(text) as T;
        return data;
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
