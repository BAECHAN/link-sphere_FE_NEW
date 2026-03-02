import type { Comment } from '@/domains/post/_common/model/comment.schema';
import { mockAccount } from '@/mocks/fixtures/auth.fixtures';
import { mockPost } from '@/mocks/fixtures/post.fixtures';

export const mockComment: Comment = {
  id: 'comment-uuid-1',
  postId: mockPost.id,
  userId: mockAccount.id,
  content: 'This is a test comment',
  isDeleted: false,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
  author: {
    id: mockAccount.id,
    nickname: mockAccount.nickname,
    image: null,
  },
  likeCount: 0,
  isLiked: false,
  replies: [],
};
