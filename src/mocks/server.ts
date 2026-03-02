import { setupServer } from 'msw/node';
import { handlers } from '@/mocks/handlers';

/**
 * MSW Node 서버 싱글톤.
 * src/test/setup.ts의 beforeAll/afterAll/afterEach에서 라이프사이클을 관리합니다.
 *
 * 특정 테스트에서 핸들러를 오버라이드하려면:
 * server.use(http.get('...', () => HttpResponse.json({ ... })))
 */
export const server = setupServer(...handlers);
