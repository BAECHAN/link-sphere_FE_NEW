import { describe, expect, it } from 'vitest';
import {
  createBookmarkFolderSchema,
  bookmarkFolderSortEnum,
  reorderBookmarkFoldersSchema,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

describe('createBookmarkFolderSchema', () => {
  it('name이 있으면 유효하다', () => {
    expect(createBookmarkFolderSchema.safeParse({ name: '새 폴더' }).success).toBe(true);
  });

  it('name이 빈 문자열이면 파싱에 실패한다', () => {
    expect(createBookmarkFolderSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('reorderBookmarkFoldersSchema', () => {
  it('folderIds 배열이 1개 이상이면 유효하다', () => {
    expect(reorderBookmarkFoldersSchema.safeParse({ folderIds: ['a', 'b'] }).success).toBe(true);
  });

  it('folderIds가 빈 배열이면 파싱에 실패한다', () => {
    expect(reorderBookmarkFoldersSchema.safeParse({ folderIds: [] }).success).toBe(false);
  });
});

describe('bookmarkFolderSortEnum', () => {
  it('latest/oldest/title/views/viewed를 허용한다', () => {
    for (const sort of ['latest', 'oldest', 'title', 'views', 'viewed']) {
      expect(bookmarkFolderSortEnum.safeParse(sort).success).toBe(true);
    }
  });

  it('정의되지 않은 값은 거부한다', () => {
    expect(bookmarkFolderSortEnum.safeParse('random').success).toBe(false);
  });
});
