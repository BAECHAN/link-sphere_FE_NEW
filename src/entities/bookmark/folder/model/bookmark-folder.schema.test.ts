import { describe, expect, it } from 'vitest';
import {
  createBookmarkFolderSchema,
  bookmarkFolderSortEnum,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

describe('createBookmarkFolderSchema', () => {
  it('name이 있으면 유효하다', () => {
    expect(createBookmarkFolderSchema.safeParse({ name: '새 폴더' }).success).toBe(true);
  });

  it('name이 빈 문자열이면 파싱에 실패한다', () => {
    expect(createBookmarkFolderSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('bookmarkFolderSortEnum', () => {
  it('latest/oldest/title/viewed를 허용한다', () => {
    for (const sort of ['latest', 'oldest', 'title', 'viewed']) {
      expect(bookmarkFolderSortEnum.safeParse(sort).success).toBe(true);
    }
  });

  it('정의되지 않은 값은 거부한다', () => {
    expect(bookmarkFolderSortEnum.safeParse('random').success).toBe(false);
    // 조회수순은 2026-11-05 제거했다 - 옛 링크의 ?sort=views는 useBookmarkPage가 최신순으로 돌린다
    expect(bookmarkFolderSortEnum.safeParse('views').success).toBe(false);
  });
});
