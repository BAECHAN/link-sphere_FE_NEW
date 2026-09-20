import dayjs from 'dayjs';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { RECENT_BOOKMARK_FOLDER_COUNT } from '@/entities/bookmark/folder/config/bookmark-folder.const';

export class BookmarkFolderUtil {
  // bookmarkFolderApi.fetchBookmarkFolderList는 apiClient.get<BookmarkFolderListResponse>()로
  // 캐싱만 할 뿐 bookmarkFolderSchema로 파싱하지 않는다 — 그래서 lastUsedAt은 (BookmarkFolder
  // 타입상 Date로 보여도) 실제로는 BE가 보낸 원시 ISO 문자열 그대로 들어온다. dayjs(value)는
  // 문자열·Date 어느 쪽이 와도 안전하게 파싱한다.
  static pickRecentFolders(folderList: BookmarkFolder[]): BookmarkFolder[] {
    const usedFolderList = folderList.filter(
      (folder) => folder.lastUsedAt !== null && folder.lastUsedAt !== undefined
    );

    // "최근 저장한 폴더"는 최대 RECENT_BOOKMARK_FOLDER_COUNT(3)개만 보여준다. 폴더
    // 총수가 정확히 그 값과 같으면(= 저장 이력 있는 폴더가 전부 3개뿐) 최근 구획과
    // "내 폴더"가 완전히 같은 3개를 정렬 기준만 바꿔(lastUsedAt vs sortOrder) 중복
    // 노출하게 된다 — 사용자는 두 목록이 같은지 모르고 둘 다 훑어 스캔 비용만 두 배가
    // 된다(NN/g, https://www.nngroup.com/articles/duplicate-links/). 폴더가 4개
    // 이상이면 "내 폴더"가 최근 구획(3개 고정 상한)보다 항상 많아 완전 일치가
    // 구조적으로 불가능하다(2026-09-21).
    if (
      usedFolderList.length < RECENT_BOOKMARK_FOLDER_COUNT ||
      folderList.length === RECENT_BOOKMARK_FOLDER_COUNT
    ) {
      return [];
    }

    return [...usedFolderList]
      .sort((a, b) => dayjs(b.lastUsedAt).valueOf() - dayjs(a.lastUsedAt).valueOf())
      .slice(0, RECENT_BOOKMARK_FOLDER_COUNT);
  }
}
