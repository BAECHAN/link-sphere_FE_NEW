import type { Post, PostListResponse } from '@/domains/post/_common/model/post.schema';
import { mockAccount } from '@/mocks/fixtures/auth.fixtures';

export const mockPost: Post = {
  id: 'post-uuid-1',
  userId: mockAccount.id,
  url: 'https://example.com/article',
  title: 'Test Article Title',
  description: 'A test article description',
  tags: ['react', 'testing'],
  categories: [
    {
      id: 1,
      name: 'Frontend',
      slug: 'frontend',
      sortOrder: 0,
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
    },
  ],
  ogImage: null,
  aiSummary: null,
  aiStatus: 'NONE',
  stats: {
    viewCount: 0,
    likeCount: 0,
    commentCount: 0,
    bookmarkCount: 0,
  },
  userInteractions: {
    isLiked: false,
    isBookmarked: false,
  },
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  isPrivate: false,
  author: {
    id: mockAccount.id,
    nickname: mockAccount.nickname,
    image: undefined,
  },
};

export const mockPostListResponse: PostListResponse = {
  page: 0,
  size: 10,
  content: [mockPost],
  totalElements: 1,
  totalPages: 1,
  last: true,
};
