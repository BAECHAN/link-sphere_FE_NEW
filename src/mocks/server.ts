import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';

/**
 * MSW Node 서버 싱글톤.
 * src/test/setup.ts의 beforeAll/afterAll/afterEach에서 라이프사이클을 관리합니다.
 *
 * 특정 테스트에서 핸들러를 오버라이드하려면(성공 응답은 스펙 타입 http 권장 — docs/TESTING.md):
 * server.use(http.get('/post/{id}', () => MockEnvelopeUtil.json({ ... })))
 */
export const server = setupServer(...handlers);
