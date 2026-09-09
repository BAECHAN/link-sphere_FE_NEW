import { http, HttpResponse } from 'msw';
import { mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

/** 핸들러 URL에 API_BASE_URL prefix를 붙여 실제 요청 URL과 일치시킵니다. */
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

export const authHandlers = [
  // POST /auth/login
  http.post(url(API_ENDPOINTS.auth.login), () => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: mockLoginResponse,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /auth/signup - 실제 BE는 ApiResponse로 감싼 AccountResponse를 돌려준다(빈 바디 아님)
  http.post(url(API_ENDPOINTS.auth.signup), () => {
    return HttpResponse.json(
      {
        status: 201,
        message: 'ok',
        data: mockAccount,
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // POST /auth/refresh
  http.post(url(API_ENDPOINTS.auth.refresh), () => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: mockLoginResponse,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /auth/logout
  http.post(url(API_ENDPOINTS.auth.logout), () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // GET /auth/email-availability - 'taken@example.com'만 중복으로 취급 (가입 화면 전용)
  http.get(url(API_ENDPOINTS.auth.emailAvailability), ({ request }) => {
    const email = new URL(request.url).searchParams.get('email');
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: { available: email !== 'taken@example.com' },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),
];
