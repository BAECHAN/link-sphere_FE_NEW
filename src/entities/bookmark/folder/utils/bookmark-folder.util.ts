import dayjs from 'dayjs';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import {
  BOOKMARK_FOLDER_NAME_MAX_LENGTH,
  RECENT_BOOKMARK_FOLDER_COUNT,
} from '@/entities/bookmark/folder/config/bookmark-folder.const';
import { TEXTS } from '@/shared/config/texts';

// "최근 저장한 폴더"는 최대 RECENT_BOOKMARK_FOLDER_COUNT(3)개만 보여준다. 폴더
// 총수가 정확히 그 값과 같으면(= 저장 이력 있는 폴더가 전부 3개뿐) 최근 구획과
// "내 폴더"가 완전히 같은 3개를 정렬 기준만 바꿔(lastUsedAt vs sortOrder) 중복
// 노출하게 된다 — 사용자는 두 목록이 같은지 모르고 둘 다 훑어 스캔 비용만 두 배가
// 된다(NN/g, https://www.nngroup.com/articles/duplicate-links/). 폴더가 4개
// 이상이면 "내 폴더"가 최근 구획(3개 고정 상한)보다 항상 많아 완전 일치가
// 구조적으로 불가능하다(2026-09-21).
function wouldDuplicateMyFoldersSection(
  usedFolderList: BookmarkFolder[],
  folderList: BookmarkFolder[]
): boolean {
  return (
    usedFolderList.length < RECENT_BOOKMARK_FOLDER_COUNT ||
    folderList.length === RECENT_BOOKMARK_FOLDER_COUNT
  );
}

export class BookmarkFolderUtil {
  // bookmarkFolderApi.fetchBookmarkFolderList는 apiClient.get<BookmarkFolderListResponse>()로
  // 캐싱만 할 뿐 런타임 파싱을 하지 않는다 — lastUsedAt은 타입(string | null) 그대로 BE가 보낸
  // ISO 문자열이고, 정렬 비교는 dayjs(value)로 감싸서 한다.
  static pickRecentFolders(folderList: BookmarkFolder[]): BookmarkFolder[] {
    const usedFolderList = folderList.filter(
      (folder) => folder.lastUsedAt !== null && folder.lastUsedAt !== undefined
    );

    if (wouldDuplicateMyFoldersSection(usedFolderList, folderList)) {
      return [];
    }

    return [...usedFolderList]
      .sort((a, b) => dayjs(b.lastUsedAt).valueOf() - dayjs(a.lastUsedAt).valueOf())
      .slice(0, RECENT_BOOKMARK_FOLDER_COUNT);
  }

  // 앞뒤 공백을 뺀 이름을 코드포인트로 센다 — 제출할 때 trim하고, BE도 trim 뒤 codePointCount로
  // 센다(string.length는 이모지 하나를 2로 센다). 상한을 넘으면 입력 아래에 띄울 문구를 돌려준다.
  static nameLengthError(name: string): string | null {
    const length = [...name.trim()].length;

    if (length <= BOOKMARK_FOLDER_NAME_MAX_LENGTH) {
      return null;
    }

    return TEXTS.validation.folderNameTooLong(BOOKMARK_FOLDER_NAME_MAX_LENGTH, length);
  }
}
