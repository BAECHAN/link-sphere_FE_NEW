import { authHandlers } from '@/mocks/handlers/auth.handlers';
import { accountHandlers } from '@/mocks/handlers/account.handlers';
import { bookmarkFolderHandlers } from '@/mocks/handlers/bookmark-folder.handlers';
import { commentHandlers } from '@/mocks/handlers/comment.handlers';
import { postHandlers } from '@/mocks/handlers/post.handlers';
import { uploadHandlers } from '@/mocks/handlers/upload.handlers';

export const handlers = [
  ...authHandlers,
  ...accountHandlers,
  ...postHandlers,
  ...commentHandlers,
  ...bookmarkFolderHandlers,
  ...uploadHandlers,
];
