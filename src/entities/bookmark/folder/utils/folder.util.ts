import dayjs from 'dayjs';
import { Folder } from '@/entities/bookmark/folder/model/folder.schema';
import {
  MIN_FOLDER_COUNT_TO_SHOW_RECENT,
  RECENT_FOLDER_COUNT,
} from '@/entities/bookmark/folder/config/const';

// folderApi.fetchFolderList는 apiClient.get<FolderListResponse>()로 캐싱만 할 뿐 folderSchema로
// 파싱하지 않는다 — 그래서 lastUsedAt은 (Folder 타입상 Date로 보여도) 실제로는 BE가 보낸 원시
// ISO 문자열 그대로 들어온다. dayjs(value)는 문자열·Date 어느 쪽이 와도 안전하게 파싱한다.
export function pickRecentFolders(folders: Folder[]): Folder[] {
  const usedFolders = folders.filter(
    (folder) => folder.lastUsedAt !== null && folder.lastUsedAt !== undefined
  );

  if (
    folders.length < MIN_FOLDER_COUNT_TO_SHOW_RECENT ||
    usedFolders.length < RECENT_FOLDER_COUNT
  ) {
    return [];
  }

  return [...usedFolders]
    .sort((a, b) => dayjs(b.lastUsedAt).valueOf() - dayjs(a.lastUsedAt).valueOf())
    .slice(0, RECENT_FOLDER_COUNT);
}
