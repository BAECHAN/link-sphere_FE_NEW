import dayjs from 'dayjs';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { ApiError, ApiResponse, ApiErrorResponse, NetworkError } from '@/shared/types/common.type';
import { useAuthStore } from '@/shared/store/auth.store';

import { FormUtil } from '@/shared/utils/form.util';
import { AuthUtil } from '@/shared/utils/auth.util';
import { DateUtil } from '@/shared/utils/date.util';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';

interface ApiRequestOptions extends RequestInit {
  searchParams?: Record<string, any>;
  responseType?: 'json' | 'blob' | 'text';
}

// entities/auth의 LoginResponse를 그대로 쓰지 않는다 - shared 레이어는 entities를 import할 수
// 없다(레이어 하향 의존 규칙). /auth/refresh 응답 중 여기서 실제로 쓰는 필드만 로컬로 선언한다.
interface RefreshTokenResponse {
  accessToken: string;
}

function appendSearchParams(url: string, searchParams?: Record<string, any>): string {
  if (!searchParams) {
    return url;
  }

  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // 쿼리 파라미터도 한글이 들어갈 수 있으니 안전하게 NFC 처리
      const stringValue = String(value).normalize('NFC');
      params.append(key, stringValue);
    }
  });

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}

function isSessionInvalidCode(code: string): boolean {
  return code === SERVER_ERROR_CODE.NOT_LOGGED_IN || code === SERVER_ERROR_CODE.INVALID_TOKEN;
}

function isApiResponseShape(json: unknown): boolean {
  return !!json && typeof json === 'object' && 'data' in json && 'status' in json;
}

/**
 * CloudFront OAC가 오리진(Lambda Function URL)으로 바디를 스트리밍만 하고 해시를
 * 대신 계산해주지 않으므로, 문자열 바디가 있는 요청은 클라이언트가 SHA256을 직접
 * 계산해 x-amz-content-sha256 헤더로 실어 보내야 한다(Lambda는 unsigned payload를
 * 지원하지 않음 - AWS 공식 문서, docs/plans/2026-09-29-oac-lockdown.md 참고).
 */
async function hashRequestBody(body: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

function parseErrorResponseBody(status: number, text: string): ApiErrorResponse {
  try {
    const parsed = JSON.parse(text) as Record<string, unknown> | null;
    // ApiErrorResponse 구조(code 있음)인지 확인
    if (parsed && typeof parsed.code === 'string') {
      return parsed as unknown as ApiErrorResponse;
    }
    // 표준 포맷이 아닌 경우 (Spring Security 기본 에러 등)
    return {
      status,
      code: String(status),
      message:
        typeof parsed?.message === 'string'
          ? parsed.message
          : typeof parsed?.error === 'string'
            ? parsed.error
            : text,
      timestamp: DateUtil.formatISO(undefined),
    };
  } catch {
    // JSON이 아닌 응답 - 우리 앱의 403(GlobalExceptionHandler)은 항상 JSON이라
    // 여기 걸릴 수 없다. 즉 403 + 파싱 실패는 CloudFront/WAF가 앱 앞에서
    // 막았다는 신호로 안전하게 쓸 수 있다.
    return {
      status,
      code: status === 403 ? SERVER_ERROR_CODE.EDGE_BLOCKED : String(status),
      message: text || 'Unknown Error',
      timestamp: dayjs().toISOString(),
    };
  }
}

// Retry-After는 초 단위 정수이거나 HTTP-date일 수 있다(RFC 9110 §10.2.3). 우리 BE는 초 단위만
// 보내므로(GlobalExceptionHandler) 그것만 읽고, 그 외 형식은 무시한다.
function parseRetryAfterSeconds(value: string | null): number | undefined {
  if (!value || !/^\d+$/.test(value.trim())) {
    return undefined;
  }

  return Number(value.trim());
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
      // CloudFront OAC(SigningBehavior: Always)가 오리진 요청의 Authorization
      // 헤더를 자신의 SigV4 서명으로 덮어쓰므로, 실제 토큰은 별도 헤더로 보낸다
      // (docs/plans/2026-09-29-oac-lockdown.md 참고). Bearer 접두어는 붙이지 않는다 -
      // 커스텀 헤더라 HTTP Authorization 스킴을 흉내 낼 이유가 없다.
      headers['X-Access-Token'] = accessToken;
    }

    return headers;
  }

  private isAuthEndpoint(endpoint: string): boolean {
    // 토큰이 만료되어도 401에러가 뜨지 않고 통과되어야 하는 API 목록
    // 로그인·회원가입만 포함한다 — 리프레시(/auth/refresh)는 이 목록에 없어 만료된
    // X-Access-Token 헤더가 있으면 그대로 실려 나간다. BE SessionAuthenticationFilter가
    // 만료된 토큰을 만나도 예외를 삼키고 필터체인을 통과시키며, refresh 핸들러는 이
    // 헤더를 아예 읽지 않아 무해함이 BE 소스로 확인됐다. 상세: docs/AUTH.md §11 항목 2
    const authEndpoints = [API_ENDPOINTS.auth.login, API_ENDPOINTS.auth.signup];
    return authEndpoints.some((path) => endpoint.includes(path));
  }

  /**
   * 데이터 전처리 (NFC 정규화 -> 빈 문자열 null 처리)
   */
  private processRequestData(data: unknown): unknown {
    if (!data || typeof data !== 'object') {
      return data;
    }

    // 1. 모든 문자열 NFC 정규화 (Mac/Window 한글 호환)
    const normalizedData = FormUtil.normalizePayload(data);

    // 2. 빈 문자열("")을 null로 변환 (기존 로직 유지)
    // normalizePayload가 객체를 리턴하므로 타입 단언이 안전함
    if (normalizedData && typeof normalizedData === 'object' && !Array.isArray(normalizedData)) {
      return FormUtil.emptyStringToNullInObject(normalizedData as Record<string, unknown>);
    }

    return normalizedData;
  }

  /**
   * TOKEN_EXPIRED 401 처리 - 재시도 상한, refresh 실행, refresh 대기 3갈래를 모두 담당한다.
   */
  private async handleTokenExpired<T>(
    endpoint: string,
    options: ApiRequestOptions | undefined,
    retryCount: number
  ): Promise<T> {
    // refresh로 새로 받은 토큰으로 재시도한 요청이 다시 TOKEN_EXPIRED를 받으면
    // (서버 시계 오차 등) 더 재시도해도 회복되지 않는다 - 상한 없이 재귀하면
    // 무한 루프가 될 수 있으므로 1회 재시도 후에는 refresh 실패와 동일하게 처리한다.
    if (retryCount > 0) {
      console.error('Token refresh succeeded but retried request still expired');
      this.refreshSubscribers = [];
      AuthUtil.clearAll();
      return new Promise(() => {});
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      try {
        const authData = await apiClient.post<RefreshTokenResponse>(API_ENDPOINTS.auth.refresh);
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
  }

  private async request<T>(
    endpoint: string,
    options?: ApiRequestOptions,
    retryCount = 0
  ): Promise<T> {
    let url = endpoint.startsWith('http') ? endpoint : `${this.baseURL}${endpoint}`;
    const isAuth = this.isAuthEndpoint(endpoint);

    url = appendSearchParams(url, options?.searchParams);

    const isFormData = options?.body instanceof FormData;
    const headers: Record<string, string> = {
      ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
      ...this.getAuthHeaders(),
      ...((options?.headers as Record<string, string>) || {}),
    };

    // 인증이 필요없는 엔드포인트에서는 X-Access-Token 헤더 제거
    if (isAuth && headers['X-Access-Token']) {
      delete headers['X-Access-Token'];
    }

    // GET이 아닌 모든 요청에 x-amz-content-sha256을 계산해 실어 보낸다 - OAC 전환
    // 후 이 헤더가 없으면 Lambda가 요청을 거절한다(hashRequestBody 주석 참고).
    // 바디가 없는 POST(예: /auth/refresh)도 대상이다 - AWS 문서가 "PUT/POST면"이라고만
    // 하지 바디 유무를 구분하지 않아, 없으면 빈 문자열의 해시를 그대로 쓴다(pr-review-toolkit
    // 리뷰에서 지적 - 빠뜨리면 새로고침마다 호출되는 refresh가 전환 즉시 깨질 수 있었다).
    // FormData는 브라우저가 전송 시점에 실제 바이트(멀티파트 boundary 포함)를
    // 만들어 미리 해시할 방법이 없다 - 지금은 apiClient로 FormData를 보내는
    // 프로덕션 경로가 없어(이미지 업로드는 Supabase에 직접 감, upload.api.ts 참고)
    // 생략한다. 앞으로 FormData 경로가 생기면 별도 해결이 필요하다.
    if (!isFormData && options?.method && options.method !== 'GET') {
      const body = typeof options.body === 'string' ? options.body : '';
      headers['x-amz-content-sha256'] = await hashRequestBody(body);
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        credentials: 'include', // 쿠키 전송을 위해 필요 (필요 시)
      }).catch((error: unknown) => {
        // 응답 없이 끝난 요청(오프라인·연결 끊김) - 사용자가 취소한 AbortError만 그대로 둔다
        if (error instanceof Error && error.name === 'AbortError') {
          throw error;
        }

        throw new NetworkError();
      });

      if (!response.ok) {
        const text = await response.text();
        const errorResponse = parseErrorResponseBody(response.status, text);

        // 1. 401 Unauthorized
        if (response.status === 401) {
          // 토큰 만료 처리
          if (errorResponse.code === SERVER_ERROR_CODE.TOKEN_EXPIRED) {
            return this.handleTokenExpired<T>(endpoint, options, retryCount);
          } else if (isSessionInvalidCode(errorResponse.code)) {
            if (endpoint.includes(API_ENDPOINTS.auth.refresh)) {
              // 앱 초기화 시 자동 호출되는 refresh는 조용히 실패 (toast/navigate 불필요)
              throw new ApiError(errorResponse);
            }
            // 로그아웃 처리 중(clearQueries의 배경 재요청) 온 401은 세션 만료가 아니라 레이스이므로 재이동하지 않는다
            if (!AuthUtil.isLoggingOut()) {
              // 토스트는 React Query 전역 핸들러(queryClient)가 단일 소유
              AuthUtil.clearAll();
            }
            throw new ApiError(errorResponse);
          }
        }

        // 2. 403 Forbidden / 404 Not Found 및 기타 에러
        // 사용자 토스트는 React Query 전역 핸들러가 담당
        const error = new ApiError(errorResponse);
        // 429면 "약 N분 뒤 다시"를 안내할 수 있게 Retry-After(초)를 함께 넘긴다. API는 같은
        // 출처(CloudFront 한 도메인)라 CORS 노출 헤더 설정 없이도 읽힌다.
        error.retryAfterSeconds = parseRetryAfterSeconds(response.headers.get('Retry-After'));
        throw error;
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

        // 백엔드 응답이 항상 ApiResponse로 래핑된다고 가정
        if (isApiResponseShape(json)) {
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

  async delete<T>(endpoint: string, data?: unknown, options?: ApiRequestOptions): Promise<T> {
    const isFormData = data instanceof FormData;
    const bodyData = isFormData ? data : this.processRequestData(data);

    return this.request<T>(endpoint, {
      ...options,
      method: 'DELETE',
      ...(data === undefined
        ? {}
        : { body: isFormData ? (bodyData as FormData) : JSON.stringify(bodyData) }),
    });
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
