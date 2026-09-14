import type {
  Comment,
  MyComment,
  MyCommentListResponse,
} from '@/entities/comment/model/comment.schema';
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

export const mockMyComment: MyComment = {
  id: 'comment-uuid-1',
  content: 'This is a test comment',
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  postId: 'post-uuid-1',
  postTitle: 'Test Post Title',
};

export const mockMyCommentListResponse: MyCommentListResponse = {
  page: 0,
  size: 10,
  content: [mockMyComment],
  totalElements: 1,
  totalPages: 1,
  last: true,
};
