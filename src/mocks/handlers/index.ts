import { authHandlers } from '@/mocks/handlers/auth.handlers';
import { commentHandlers } from '@/mocks/handlers/comment.handlers';
import { folderHandlers } from '@/mocks/handlers/folder.handlers';
import { postHandlers } from '@/mocks/handlers/post.handlers';
import { uploadHandlers } from '@/mocks/handlers/upload.handlers';

export const handlers = [
  ...authHandlers,
  ...postHandlers,
  ...commentHandlers,
  ...folderHandlers,
  ...uploadHandlers,
];
