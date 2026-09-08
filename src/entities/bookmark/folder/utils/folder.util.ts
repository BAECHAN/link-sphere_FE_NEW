import dayjs from 'dayjs';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/folder.schema';
import {
  MIN_BOOKMARK_FOLDER_COUNT_TO_SHOW_RECENT,
  RECENT_BOOKMARK_FOLDER_COUNT,
} from '@/entities/bookmark/folder/config/folder.const';

export class BookmarkFolderUtil {
  // bookmarkFolderApi.fetchBookmarkFolderList는 apiClient.get<BookmarkFolderListResponse>()로
  // 캐싱만 할 뿐 bookmarkFolderSchema로 파싱하지 않는다 — 그래서 lastUsedAt은 (BookmarkFolder
  // 타입상 Date로 보여도) 실제로는 BE가 보낸 원시 ISO 문자열 그대로 들어온다. dayjs(value)는
  // 문자열·Date 어느 쪽이 와도 안전하게 파싱한다.
  static pickRecentFolders(folders: BookmarkFolder[]): BookmarkFolder[] {
    const usedFolders = folders.filter(
      (folder) => folder.lastUsedAt !== null && folder.lastUsedAt !== undefined
    );

    if (
      folders.length < MIN_BOOKMARK_FOLDER_COUNT_TO_SHOW_RECENT ||
      usedFolders.length < RECENT_BOOKMARK_FOLDER_COUNT
    ) {
      return [];
    }

    return [...usedFolders]
      .sort((a, b) => dayjs(b.lastUsedAt).valueOf() - dayjs(a.lastUsedAt).valueOf())
      .slice(0, RECENT_BOOKMARK_FOLDER_COUNT);
  }
}
