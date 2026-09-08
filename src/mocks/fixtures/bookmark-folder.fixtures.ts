import type {
  BookmarkFolder,
  BookmarkFolderListResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

export const mockBookmarkFolder: BookmarkFolder = {
  id: 'folder-uuid-1',
  name: '개발',
  sortOrder: 0,
  bookmarkCount: 1,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

export const mockBookmarkFolderListResponse: BookmarkFolderListResponse = {
  folders: [mockBookmarkFolder],
  uncategorizedCount: 0,
};
