import { http, HttpResponse } from 'msw';
import { mockAccount, mockLoginResponse } from '@/mocks/fixtures/auth.fixtures';
import { API_ENDPOINTS } from '@/shared/config/api';

export const authHandlers = [
  // POST /auth/login
  http.post(`${API_ENDPOINTS.auth.login}`, () => {
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
  http.post(`${API_ENDPOINTS.auth.signup}`, () => {
    return new HttpResponse(null, { status: 201 });
  }),

  // POST /auth/refresh
  http.post(`${API_ENDPOINTS.auth.refresh}`, () => {
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
  http.get(`${API_ENDPOINTS.auth.account}`, () => {
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
  http.post(`${API_ENDPOINTS.auth.logout}`, () => {
    return new HttpResponse(null, { status: 204 });
  }),
];
