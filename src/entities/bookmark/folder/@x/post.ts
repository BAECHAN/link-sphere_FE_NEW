// entities/post가 참조하는 bookmark/folder의 공개 표면 (FSD @x 표기 — docs/FE-ARCHITECTURE.md 참고)
export {
  bookmarkFolderKeys,
  handleBookmarkToggleSuccess,
  handlePostContentUpdateSuccess,
  handlePostDeleteSuccess,
} from '@/entities/bookmark/folder/api/bookmark-folder.keys';
export type { BookmarkFolderListResponse } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
