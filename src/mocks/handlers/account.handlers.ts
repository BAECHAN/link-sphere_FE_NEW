import { http, HttpResponse } from 'msw';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

/** 핸들러 URL에 API_BASE_URL prefix를 붙여 실제 요청 URL과 일치시킵니다. */
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

export const accountHandlers = [
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

  // GET /auth/account/nickname-availability - 'taken'만 중복으로 취급
  http.get(url(API_ENDPOINTS.auth.nicknameAvailability), ({ request }) => {
    const nickname = new URL(request.url).searchParams.get('nickname');
    return HttpResponse.json(
      {
        status: 200,
        message: 'ok',
        data: { available: nickname !== 'taken' },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }),
];
