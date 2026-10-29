import dayjs from 'dayjs';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import {
  ApiError,
  ApiResponse,
  ApiErrorResponse,
  NetworkError,
  SessionChangedError,
  SessionExpiredError,
} from '@/shared/types/common.type';
import { useAuthStore } from '@/shared/store/auth.store';

import { FormUtil } from '@/shared/utils/form.util';
import { AuthUtil } from '@/shared/utils/auth.util';
import { AuthEpochUtil, type AuthEpoch } from '@/shared/utils/auth-epoch.util';
import { DateUtil } from '@/shared/utils/date.util';
import { ErrorUtil } from '@/shared/utils/error.util';
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

/** 리더의 refresh를 기다리는 요청 - 끝나면 재시도하거나, 그사이 인증 세대가 바뀌었으면 취소한다 */
interface RefreshSubscriber {
  retry: () => void;
  cancel: (error: Error) => void;
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
  private refreshSubscribers: RefreshSubscriber[] = [];
  // refresh가 거절돼 만료로 정리한 토큰 - 그 토큰으로 나갔다가 늦게 도착한 401이 refresh·정리를 다시 일으키지 않게 한다
  private expiredToken: string | undefined;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
  }

  private subscribeTokenRefresh(subscriber: RefreshSubscriber) {
    this.refreshSubscribers.push(subscriber);
  }

  private notifySubscribers() {
    this.refreshSubscribers.forEach((subscriber) => subscriber.retry());
    this.refreshSubscribers = [];
  }

  private cancelSubscribers(error: Error) {
    this.refreshSubscribers.forEach((subscriber) => subscriber.cancel(error));
    this.refreshSubscribers = [];
  }

  /**
   * 로그인이 만료됐다 - 이 탭을 정리하고 리더·대기 요청을 모두 SessionExpiredError로 끝낸다. 끝내지 않고 두면
   * 화면에 남은 폼이 "저장 중"에 멈추고 댓글은 비웠던 입력을 되돌리지 못한다. 실패 토스트는 뜨지 않는다 - 전역
   * 핸들러와 직접 토스트를 띄우는 곳 모두 이 에러를 조용히 넘긴다(error-toast.ts, ErrorUtil.isSessionExpired).
   * 화면은 떠나지 않는다 - 그 자리에서 다시 로그인하게 한다(AuthUtil.applySessionExpired). 스토어 토큰이 이 요청이 보낸
   * 토큰일 때만 정리한다 - 그 사이 다른 경로(먼저 끝난 만료, 로그아웃)가 이미 토큰을 바꿨으면 다시 정리하지 않는다.
   * 동작은 client.test.ts Case 1-2·2·2-1이 고정한다.
   */
  private expireSession(sentToken: string | undefined): never {
    const expired = new SessionExpiredError();
    this.expiredToken = sentToken;
    this.cancelSubscribers(expired);

    if (useAuthStore.getState().accessToken === sentToken) {
      AuthUtil.applySessionExpired();
    }

    throw expired;
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
    // 로그인·회원가입만 포함한다 — 리프레시(/auth/refresh)를 여기 넣으면 안 된다. refresh는
    // X-Access-Token(만료된 토큰이어도)을 읽어 쿠키 주인과 같은 회원인지 확인한다(다르면 409
    // SESSION_MISMATCH, handleTokenExpired). 헤더를 빼면 그 확인이 조용히 꺼진다. BE
    // SessionAuthenticationFilter는 만료된 토큰을 만나도 예외를 삼키고 필터체인을 통과시킨다.
    // 상세: docs/AUTH.md §11 항목 2
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
   * TOKEN_EXPIRED 401 처리 - 이미 갱신된 토큰으로 재시도, 재시도 상한, refresh 실행,
   * refresh 대기 4갈래를 모두 담당한다.
   *
   * authEpoch는 이 요청을 처음 보낼 때 이 탭 토큰이 속했던 인증 세대다. 그 뒤 세대가 바뀌었으면(다른 탭·같은 탭의
   * 명시적 로그인·로그아웃 - 같은 탭은 localStorage에 못 써도 잡힌다) 공유 refresh 쿠키가 다른 계정의 것일 수 있다 -
   * BE는 폐기된 세션의 토큰도 TOKEN_EXPIRED로 답하므로, 갱신·재시도하면 이 요청이 다른 계정으로 실행된다. 그래서
   * 그런 요청은 갱신·재시도·로그인 화면 이동 없이 SessionChangedError로 끝내고, 화면은 useAuthEpochSync가
   * 맞춘다(client.test.ts Case 7·9, docs/AUTH.md §8-B).
   */
  private async handleTokenExpired<T>(
    endpoint: string,
    options: ApiRequestOptions | undefined,
    retryCount: number,
    sentToken: string | undefined,
    authEpoch: AuthEpoch
  ): Promise<T> {
    if (AuthEpochUtil.hasChangedSince(authEpoch)) {
      throw new SessionChangedError();
    }

    // 이 요청을 보낸 뒤 다른 요청이 이미 refresh를 마쳤다면(늦게 도착한 401) refresh 없이
    // 지금 토큰으로 재시도만 한다. 리더의 finally는 재시도 완료를 기다리지 않고
    // isRefreshing을 내리므로 이런 401은 대기 큐가 아니라 아래 리더 경로로 들어오는데,
    // 거기서 refresh를 또 부르면 BE가 세션을 회전시켜(이전 행 폐기) 첫 refresh 토큰으로
    // 재시도 중이던 요청까지 만료돼 로그아웃된다(client.test.ts Case 1-3). 토큰이 실제로
    // 바뀌었을 때만 타므로 재시도 상한보다 먼저 둬도 같은 토큰으로 반복 재시도하지 않는다.
    const currentToken = useAuthStore.getState().accessToken;

    if (currentToken && currentToken !== sentToken) {
      return this.request<T>(endpoint, options, retryCount + 1, authEpoch);
    }

    // 이미 만료로 정리한 토큰으로 나갔던 요청이 늦게 돌아왔다 - refresh를 또 부르면 같은 거절을 한 번 더 겪고
    // 정리가 두 번 돈다(화면이 다시 불러와지며 깜빡인다). 같은 만료로 끝낸다(client.test.ts Case 2-2).
    // "지금 토큰이 없다"만으로 판정하지 않는다 - SESSION_MISMATCH 로그아웃도 세대를 그대로 둔 채 토큰만 지우는데,
    // 그 뒤 늦게 온 401은 아래 refresh가 다시 거절당해 SessionChangedError로 끝나야 한다(Case 8-4).
    if (!currentToken && sentToken && sentToken === this.expiredToken) {
      throw new SessionExpiredError();
    }

    // refresh로 새로 받은 토큰으로 재시도한 요청이 다시 TOKEN_EXPIRED를 받으면
    // (서버 시계 오차 등) 더 재시도해도 회복되지 않는다 - 상한 없이 재귀하면
    // 무한 루프가 될 수 있으므로 1회 재시도 후에는 refresh 실패와 동일하게 처리한다.
    if (retryCount > 0) {
      console.error('Token refresh succeeded but retried request still expired');
      return this.expireSession(sentToken);
    }

    if (!this.isRefreshing) {
      this.isRefreshing = true;
      try {
        // 원 요청이 보낸 토큰을 실어 보낸다 - BE가 refresh 쿠키의 회원과 비교해 다르면 발급하지 않고 409
        // SESSION_MISMATCH로 답한다(다른 탭에서 다른 계정으로 로그인해 공유 쿠키가 바뀐 경우). 지금 스토어 토큰이
        // 아니라 sentToken이어야 한다: 불일치로 이 탭을 로그아웃한 뒤 늦게 도착한 401은 스토어에 토큰이 없어
        // 헤더 없이 갱신되고, 그러면 BE가 비교를 건너뛰어 그 요청이 새 계정으로 재실행된다.
        const authData = await apiClient.post<RefreshTokenResponse>(
          API_ENDPOINTS.auth.refresh,
          undefined,
          sentToken ? { headers: { 'X-Access-Token': sentToken } } : undefined
        );
        if (!authData || !authData.accessToken) {
          throw new Error(
            `${TEXTS.messages.error.tokenRefreshFailed} ${TEXTS.messages.error.unauthorizedAccessToken}`
          );
        }

        // refresh를 기다리는 사이 세대가 바뀌었으면 받은 토큰은 다른 계정의 것일 수 있다 - 버린다(아래 catch)
        if (AuthEpochUtil.hasChangedSince(authEpoch)) {
          throw new SessionChangedError();
        }

        const { accessToken } = authData;
        useAuthStore.getState().setAuth(accessToken);
        this.notifySubscribers();
        return this.request<T>(endpoint, options, retryCount + 1, authEpoch);
      } catch (error) {
        // 세대가 바뀌었으면 refresh 성공·실패와 상관없이 리더·대기 요청 모두 끝낸다. 대기 요청은 refresh 전
        // 토큰으로 보낸 것이라 재시도하면 같은 토큰으로 다시 만료돼 로그아웃 경로로 빠진다. clearAll도 하지
        // 않는다 - 이동·정리는 로그아웃한 쪽과 useAuthEpochSync가 이미 했다
        if (error instanceof SessionChangedError || AuthEpochUtil.hasChangedSince(authEpoch)) {
          const sessionChanged = new SessionChangedError();
          this.cancelSubscribers(sessionChanged);
          throw sessionChanged;
        }

        // 쿠키 주인이 다른 회원이라 BE가 갱신을 거절했다 - 인증 세대는 그대로인 경우다(업데이트 전 번들 탭의 로그인,
        // localStorage 쓰기 실패 등). 이 탭을 로그아웃하고 리더·대기 요청을 모두 끝낸다. clearAll은 하지 않는다 -
        // 공유 세션 플래그를 지우면 쿠키 주인 계정의 탭이 새로고침 때 복원되지 않는다. 늦게 도착한 401로 이미
        // 로그아웃한 뒤라면(스토어 토큰이 원 요청의 토큰과 다름) 다시 하지 않는다.
        if (ErrorUtil.isSessionMismatch(error)) {
          if (useAuthStore.getState().accessToken === sentToken) {
            AuthUtil.applySessionMismatch();
          }

          const sessionChanged = new SessionChangedError();
          this.cancelSubscribers(sessionChanged);
          throw sessionChanged;
        }

        console.error(error);

        // refresh가 401로 거절된 경우만 만료다. 네트워크·5xx·429는 세션이 아니라 연결·서버 문제라 로그인을 그대로 두고
        // 그 에러로 끝낸다 - 만료로 정리하면 잠깐 끊긴 것만으로 로그아웃되고 다른 탭과 함께 쓰는 세션 플래그까지 지워진다
        // (docs/plans/2026-10-28-session-expiry-draft-preservation.md 결정 12, client.test.ts Case 2-3)
        if (!ErrorUtil.isRefreshRejected(error)) {
          this.cancelSubscribers(error as Error);
          throw error;
        }

        return this.expireSession(sentToken);
      } finally {
        this.isRefreshing = false;
      }
    } else {
      // 이미 갱신 중이라면 새 토큰 발급 완료까지 대기 후 재시도
      return new Promise<T>((resolve, reject) => {
        // 재시도는 리더가 C2(세대 확인)를 통과한 직후에만 불려, 그때 대기 요청의 세대도 리더와 같다
        this.subscribeTokenRefresh({
          retry: () => resolve(this.request<T>(endpoint, options, retryCount + 1, authEpoch)),
          cancel: reject,
        });
      });
    }
  }

  /**
   * @param authEpoch 이 요청이 속한 인증 세대. 처음 보낼 때 이 탭 토큰의 세대로 잡고, 재시도는 처음 값을
   *   그대로 넘긴다(handleTokenExpired 참고).
   */
  private async request<T>(
    endpoint: string,
    options?: ApiRequestOptions,
    retryCount = 0,
    authEpoch: AuthEpoch = AuthEpochUtil.ofToken()
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
            return this.handleTokenExpired<T>(
              endpoint,
              options,
              retryCount,
              headers['X-Access-Token'],
              authEpoch
            );
          } else if (isSessionInvalidCode(errorResponse.code)) {
            if (endpoint.includes(API_ENDPOINTS.auth.refresh)) {
              // 앱 초기화 시 자동 호출되는 refresh는 조용히 실패 (toast/navigate 불필요)
              throw new ApiError(errorResponse);
            }
            // 보낸 뒤 인증 세대가 바뀌었으면(예: 비로그인으로 보낸 요청이 돌아오기 전에 이 탭에서 로그인)
            // 이 401은 지금 세션과 무관하다 - clearAll로 방금 한 로그인을 지우지 않는다(client.test.ts Case 7-6)
            if (AuthEpochUtil.hasChangedSince(authEpoch)) {
              throw new SessionChangedError();
            }

            // 로그인이 풀린 채 쓰던 화면에 머무는 중이다(auth.store signedOutInPlace) - 로그인 창이 이미 떠 있거나
            // 사용자가 닫았다. 로그인 페이지로 보내면 쓰던 글이 사라지므로 조용히 끝낸다. 폼은 이 에러를 보고
            // "로그인이 풀려 저장하지 못했어요"를 띄운다(ErrorUtil.isSessionExpired, 결정 13)
            if (useAuthStore.getState().signedOutInPlace) {
              throw new SessionExpiredError();
            }

            // 토큰을 실어 보냈는데 무효라고 했다 - 로그인 만료다. NOT_LOGGED_IN은 BE가 토큰이 아예 없을 때만 주므로
            // 만료로 보지 않는다(로그인한 적 없는 사용자에게 "만료" 안내가 뜨지 않게, 결정 13)
            const sentToken = headers['X-Access-Token'];

            if (sentToken && errorResponse.code === SERVER_ERROR_CODE.INVALID_TOKEN) {
              if (useAuthStore.getState().accessToken === sentToken) {
                AuthUtil.applySessionExpired();
              }

              throw new SessionExpiredError();
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
      // AbortError는 사용자가 의도적으로 취소한 것, SessionChangedError는 인증 세대가 바뀌어 일부러 끝낸
      // 것이므로 로그 출력 제외
      if (
        (error instanceof Error && error.name === 'AbortError') ||
        error instanceof SessionChangedError
      ) {
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
