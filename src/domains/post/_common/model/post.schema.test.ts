import { describe, expect, it } from 'vitest';
import {
  createPostSchema,
  postSchema,
  updatePostSchema,
} from '@/domains/post/_common/model/post.schema';

describe('postSchema', () => {
  const validPost = {
    id: 'post-uuid-1',
    userId: 'user-uuid-1',
    url: 'https://example.com',
    title: 'Valid Title',
    description: null,
    tags: ['react'],
    categories: null,
    ogImage: null,
    aiSummary: null,
    aiStatus: 'NONE' as const,
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
    createdAt: new Date('2025-01-01'),
    isPrivate: false,
    author: {
      id: 'user-uuid-1',
      nickname: 'testuser',
      image: undefined,
    },
  };

  it('유효한 포스트 데이터를 파싱한다', () => {
    const result = postSchema.safeParse(validPost);
    expect(result.success).toBe(true);
  });

  it('url이 없으면 파싱에 실패한다', () => {
    const { url: _, ...withoutUrl } = validPost;
    const result = postSchema.safeParse(withoutUrl);
    expect(result.success).toBe(false);
  });

  it('url 형식이 잘못되면 파싱에 실패한다', () => {
    const result = postSchema.safeParse({ ...validPost, url: 'not-a-valid-url' });
    expect(result.success).toBe(false);
  });

  it('aiStatus가 올바른 enum 값이어야 한다', () => {
    const result = postSchema.safeParse({ ...validPost, aiStatus: 'INVALID_STATUS' });
    expect(result.success).toBe(false);
  });

  it('createdAt 문자열을 Date 객체로 변환한다', () => {
    const result = postSchema.safeParse({
      ...validPost,
      createdAt: '2025-01-01T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
    }
  });
});

describe('createPostSchema', () => {
  it('url만 있어도 유효하다', () => {
    const result = createPostSchema.safeParse({
      url: 'https://example.com',
      isPrivate: false,
    });
    expect(result.success).toBe(true);
  });

  it('url 형식이 잘못되면 파싱에 실패한다', () => {
    const result = createPostSchema.safeParse({
      url: 'not-a-url',
      isPrivate: false,
    });
    expect(result.success).toBe(false);
  });

  it('isPrivate가 없으면 파싱에 실패한다', () => {
    const result = createPostSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(false);
  });

  it('categoryIds는 선택 사항이다', () => {
    const result = createPostSchema.safeParse({
      url: 'https://example.com',
      isPrivate: true,
      categoryIds: [1, 2],
    });
    expect(result.success).toBe(true);
  });
});

describe('updatePostSchema', () => {
  it('title과 isPrivate만 있어도 유효하다', () => {
    const result = updatePostSchema.safeParse({
      title: 'Updated Title',
      isPrivate: false,
    });
    expect(result.success).toBe(true);
  });

  it('title이 빈 문자열이면 파싱에 실패한다', () => {
    const result = updatePostSchema.safeParse({
      title: '',
      isPrivate: false,
    });
    expect(result.success).toBe(false);
  });
});
