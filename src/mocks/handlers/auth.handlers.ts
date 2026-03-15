import { http, HttpResponse } from 'msw';
import { mockAccount, mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
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

  // POST /auth/signup
  http.post(url(API_ENDPOINTS.auth.signup), () => {
    return new HttpResponse(null, { status: 201 });
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

  // GET /auth/account
  http.get(url(API_ENDPOINTS.auth.account), () => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: mockAccount,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /auth/logout
  http.post(url(API_ENDPOINTS.auth.logout), () => {
    return new HttpResponse(null, { status: 204 });
  }),

  // PATCH /auth/account
  http.patch(url(API_ENDPOINTS.auth.updateAccount), async ({ request }) => {
    const body = (await request.json()) as { nickname?: string; image?: string };
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: { ...mockAccount, ...body },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),

  // POST /auth/account/avatar
  http.post(url(API_ENDPOINTS.auth.uploadAvatar), () => {
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: { imageUrl: 'https://supabase.co/storage/v1/object/public/avatars/test.png' },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),
];
