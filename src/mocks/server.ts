import { setupServer } from 'msw/node';
import { authHandlers } from '@/mocks/handlers/auth.handlers';
import { accountHandlers } from '@/mocks/handlers/account.handlers';
import { bookmarkFolderHandlers } from '@/mocks/handlers/bookmark-folder.handlers';
import { commentHandlers } from '@/mocks/handlers/comment.handlers';
import { postHandlers } from '@/mocks/handlers/post.handlers';
import { uploadHandlers } from '@/mocks/handlers/upload.handlers';

/**
 * MSW Node 서버 싱글톤.
 * src/test/setup.ts의 beforeAll/afterAll/afterEach에서 라이프사이클을 관리합니다.
 *
 * 특정 테스트에서 핸들러를 오버라이드하려면(성공 응답은 스펙 타입 http 권장 — docs/TESTING.md):
 * server.use(http.get('/post/{id}', () => MockEnvelopeUtil.json({ ... })))
 */
export const server = setupServer(
  ...authHandlers,
  ...accountHandlers,
  ...postHandlers,
  ...commentHandlers,
  ...bookmarkFolderHandlers,
  ...uploadHandlers
);
