import { authHandlers } from '@/mocks/handlers/auth.handlers';
import { commentHandlers } from '@/mocks/handlers/comment.handlers';
import { postHandlers } from '@/mocks/handlers/post.handlers';

export const handlers = [...authHandlers, ...postHandlers, ...commentHandlers];
