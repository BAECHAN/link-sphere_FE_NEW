import type { Folder, FolderListResponse } from '@/entities/folder/model/folder.schema';

export const mockFolder: Folder = {
  id: 'folder-uuid-1',
  name: '개발',
  sortOrder: 0,
  bookmarkCount: 1,
  createdAt: new Date('2025-01-01T00:00:00.000Z'),
  updatedAt: new Date('2025-01-01T00:00:00.000Z'),
};

export const mockFolderListResponse: FolderListResponse = {
  folders: [mockFolder],
  uncategorizedCount: 0,
};
