import { http } from '@/mocks/http';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';

export const uploadHandlers = [
  // POST /upload/signed-url
  http.post('/upload/signed-url', () => {
    return MockEnvelopeUtil.json(
      {
        uploadUrl: 'https://mock-storage.test/upload',
        token: 'mock-token',
        publicUrl: 'https://mock-storage.test/public/mock-file.png',
      },
      201
    );
  }),

  // 서명 URL로의 직접 업로드 (외부 스토리지 도메인) — BE 스펙 밖이라 타입 없는 http.untyped
  http.untyped.put('https://mock-storage.test/upload', () => {
    return new Response(null, { status: 200 });
  }),
];
