import type {
  BookmarkFolder,
  BookmarkFolderListResponse,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';

export const mockBookmarkFolder: BookmarkFolder = {
  id: 'folder-uuid-1',
  name: '개발',
  sortOrder: 0,
  bookmarkCount: 1,
};

export const mockBookmarkFolderListResponse: BookmarkFolderListResponse = {
  folders: [mockBookmarkFolder],
  uncategorizedCount: 0,
};
