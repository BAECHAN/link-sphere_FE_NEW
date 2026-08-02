import { http, HttpResponse } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

export const uploadHandlers = [
  // POST /upload/signed-url
  http.post(url(API_ENDPOINTS.upload.signedUrl), () => {
    return HttpResponse.json(
      {
        status: 201,
        message: 'ok',
        data: {
          uploadUrl: 'https://mock-storage.test/upload',
          token: 'mock-token',
          publicUrl: 'https://mock-storage.test/public/mock-file.png',
        },
        timestamp: new Date().toISOString(),
      },
      { status: 201 }
    );
  }),

  // 서명 URL로의 직접 업로드 (외부 스토리지 도메인)
  http.put('https://mock-storage.test/upload', () => {
    return new HttpResponse(null, { status: 200 });
  }),
];
