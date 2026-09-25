import { describe, expect, it } from 'vitest';
import { createPostSchema, updatePostSchema } from '@/entities/post/model/post.schema';
import { TEXTS } from '@/shared/config/texts';

describe('createPostSchema', () => {
  it('url만 있어도 유효하다', () => {
    const result = createPostSchema.safeParse({
      url: 'https://example.com',
      isPrivate: false,
      bookmark: false,
      folderIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('url 형식이 잘못되면 파싱에 실패한다', () => {
    const result = createPostSchema.safeParse({
      url: 'not-a-url',
      isPrivate: false,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.urlFormat);
    }
  });

  it.each([
    'file:///private/tmp/journey.html#view=create-path',
    'blob:https://example.com/uuid',
    'data:text/plain;base64,aGVsbG8=',
    'javascript:alert(1)',
    'ftp://example.com/file.txt',
    'HTTPS://example.com',
  ])('http/https가 아닌 스킴(%s)은 파싱에 실패하고 urlFormat 메시지를 반환한다', (url) => {
    const result = createPostSchema.safeParse({
      url,
      isPrivate: false,
      bookmark: false,
      folderIds: [],
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.urlFormat);
    }
  });

  it.each(['http://example.com', '  https://example.com  '])(
    'http/https 스킴(%s)은 앞뒤 공백이 있어도 유효하다',
    (url) => {
      const result = createPostSchema.safeParse({
        url,
        isPrivate: false,
        bookmark: false,
        folderIds: [],
      });
      expect(result.success).toBe(true);
    }
  );

  it('isPrivate가 없으면 파싱에 실패한다', () => {
    const result = createPostSchema.safeParse({ url: 'https://example.com' });
    expect(result.success).toBe(false);
  });

  it('categoryIds는 선택 사항이다', () => {
    const result = createPostSchema.safeParse({
      url: 'https://example.com',
      isPrivate: true,
      categoryIds: [1, 2],
      bookmark: false,
      folderIds: [],
    });
    expect(result.success).toBe(true);
  });

  it('bookmark나 folderIds가 없으면 파싱에 실패한다', () => {
    const result = createPostSchema.safeParse({
      url: 'https://example.com',
      isPrivate: false,
    });
    expect(result.success).toBe(false);
  });

  it('folderIds에 폴더 여러 개를 담을 수 있다', () => {
    const result = createPostSchema.safeParse({
      url: 'https://example.com',
      isPrivate: false,
      bookmark: true,
      folderIds: ['folder-uuid-1', 'folder-uuid-2'],
    });
    expect(result.success).toBe(true);
  });
});

describe('updatePostSchema', () => {
  it('url, title, isPrivate만 있어도 유효하다', () => {
    const result = updatePostSchema.safeParse({
      url: 'https://example.com',
      title: 'Updated Title',
      isPrivate: false,
    });
    expect(result.success).toBe(true);
  });

  it('title이 비어 있어도 유효하다 (URL 변경 시 새 링크에서 가져옴)', () => {
    const result = updatePostSchema.safeParse({
      url: 'https://example.com',
      title: '',
      isPrivate: false,
    });
    expect(result.success).toBe(true);
  });

  it('url 형식이 아니면 파싱에 실패한다', () => {
    const result = updatePostSchema.safeParse({
      url: 'not-a-url',
      title: 'Updated Title',
      isPrivate: false,
    });
    expect(result.success).toBe(false);
  });

  it('http/https가 아닌 스킴(file://)은 파싱에 실패한다', () => {
    const result = updatePostSchema.safeParse({
      url: 'file:///private/tmp/journey.html#view=create-path',
      title: 'Updated Title',
      isPrivate: false,
    });
    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(TEXTS.validation.urlFormat);
    }
  });
});
