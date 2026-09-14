import type { Comment } from '@/entities/comment/model/comment.schema';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';

export const mockComment: Comment = {
  id: 'comment-uuid-1',
  content: 'This is a test comment',
  isDeleted: false,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  author: {
    id: mockAccount.id,
    nickname: mockAccount.nickname,
    image: null,
  },
  likeCount: 0,
  isLiked: false,
  replies: [],
};
