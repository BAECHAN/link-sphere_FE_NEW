import type { Post, PostListResponse } from '@/entities/post/model/post.schema';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';

export const mockPost: Post = {
  id: 'post-uuid-1',
  url: 'https://example.com/article',
  title: 'Test Article Title',
  description: 'A test article description',
  tags: ['react', 'testing'],
  categories: [
    {
      id: 1,
      name: 'Frontend',
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
    bookmarkFolderIds: [],
  },
  createdAt: '2025-01-01T00:00:00.000Z',
  isPrivate: false,
  isSemanticMatch: false,
  author: {
    id: mockAccount.id,
    nickname: mockAccount.nickname,
    image: undefined,
  },
};

export const mockPostListResponse: PostListResponse = {
  content: [mockPost],
  nextCursor: null,
};
