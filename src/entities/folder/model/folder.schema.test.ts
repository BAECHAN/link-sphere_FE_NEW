import { describe, expect, it } from 'vitest';
import {
  createFolderSchema,
  folderSchema,
  folderSortEnum,
  moveBookmarkSchema,
  reorderFoldersSchema,
} from '@/entities/folder/model/folder.schema';

describe('folderSchema', () => {
  const validFolder = {
    id: 'folder-uuid-1',
    name: '읽을거리',
    sortOrder: 0,
    bookmarkCount: 3,
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-02'),
  };

  it('유효한 폴더 데이터를 파싱한다', () => {
    const result = folderSchema.safeParse(validFolder);
    expect(result.success).toBe(true);
  });

  it('createdAt/updatedAt 문자열을 Date 객체로 변환한다', () => {
    const result = folderSchema.safeParse({
      ...validFolder,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-02T00:00:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.createdAt).toBeInstanceOf(Date);
      expect(result.data.updatedAt).toBeInstanceOf(Date);
    }
  });

  it('sortOrder가 음수면 파싱에 실패한다', () => {
    const result = folderSchema.safeParse({ ...validFolder, sortOrder: -1 });
    expect(result.success).toBe(false);
  });

  it('bookmarkCount가 음수면 파싱에 실패한다', () => {
    const result = folderSchema.safeParse({ ...validFolder, bookmarkCount: -1 });
    expect(result.success).toBe(false);
  });
});

describe('createFolderSchema', () => {
  it('name이 있으면 유효하다', () => {
    expect(createFolderSchema.safeParse({ name: '새 폴더' }).success).toBe(true);
  });

  it('name이 빈 문자열이면 파싱에 실패한다', () => {
    expect(createFolderSchema.safeParse({ name: '' }).success).toBe(false);
  });
});

describe('moveBookmarkSchema', () => {
  it('folderId가 UUID 문자열이면 유효하다', () => {
    expect(moveBookmarkSchema.safeParse({ folderId: 'folder-uuid-1' }).success).toBe(true);
  });

  it('folderId가 null이면(미분류) 유효하다', () => {
    expect(moveBookmarkSchema.safeParse({ folderId: null }).success).toBe(true);
  });

  it('folderId 키가 없으면 파싱에 실패한다', () => {
    expect(moveBookmarkSchema.safeParse({}).success).toBe(false);
  });
});

describe('reorderFoldersSchema', () => {
  it('folderIds 배열이 1개 이상이면 유효하다', () => {
    expect(reorderFoldersSchema.safeParse({ folderIds: ['a', 'b'] }).success).toBe(true);
  });

  it('folderIds가 빈 배열이면 파싱에 실패한다', () => {
    expect(reorderFoldersSchema.safeParse({ folderIds: [] }).success).toBe(false);
  });
});

describe('folderSortEnum', () => {
  it('latest/oldest/title/views를 허용한다', () => {
    for (const sort of ['latest', 'oldest', 'title', 'views']) {
      expect(folderSortEnum.safeParse(sort).success).toBe(true);
    }
  });

  it('정의되지 않은 값은 거부한다', () => {
    expect(folderSortEnum.safeParse('random').success).toBe(false);
  });
});
