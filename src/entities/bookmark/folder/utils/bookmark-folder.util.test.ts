import { describe, expect, it } from 'vitest';
import { BookmarkFolderUtil } from '@/entities/bookmark/folder/utils/bookmark-folder.util';
import { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';

// lastUsedAt은 BE가 실제로 보내는 원시 ISO 문자열 그대로 다룬다 — apiClient는 이 필드를
// Date로 파싱하지 않는다(bookmark-folder.util.ts 참고). 정렬은 dayjs가 하므로 문자열이면
// 충분하다.
function makeFolder(
  overrides: Partial<BookmarkFolder> & Pick<BookmarkFolder, 'id'>
): BookmarkFolder {
  return {
    name: overrides.id,
    sortOrder: 0,
    bookmarkCount: 0,
    lastUsedAt: undefined,
    ...overrides,
  };
}

describe('BookmarkFolderUtil', () => {
  describe('pickRecentFolders', () => {
    it('저장 이력 있는 폴더가 3개 미만이면 폴더 총수가 많아도 빈 배열을 반환한다', () => {
      const folders = [
        makeFolder({ id: 'f1', lastUsedAt: '2025-01-01' }),
        makeFolder({ id: 'f2', lastUsedAt: '2025-01-02' }),
        makeFolder({ id: 'f3' }),
        makeFolder({ id: 'f4' }),
        makeFolder({ id: 'f5' }),
        makeFolder({ id: 'f6' }),
      ];

      expect(BookmarkFolderUtil.pickRecentFolders(folders)).toEqual([]);
    });

    it('폴더가 정확히 3개고 전부 저장 이력이 있으면(완전 일치) 빈 배열을 반환한다', () => {
      // 최근 구획은 최대 3개까지만 보여준다(RECENT_BOOKMARK_FOLDER_COUNT). 전체 폴더가
      // 정확히 3개면 "내 폴더" 본 목록도 정확히 이 3개와 같아져, 정렬 기준만
      // (lastUsedAt vs sortOrder) 다른 채로 완전히 같은 목록이 두 번 뜨게 된다 — NN/g
      // 중복 링크 연구(https://www.nngroup.com/articles/duplicate-links/) 근거로 배제한다.
      const folders = [1, 2, 3].map((n) =>
        makeFolder({ id: `f${n}`, lastUsedAt: `2025-01-0${n}` })
      );

      expect(BookmarkFolderUtil.pickRecentFolders(folders)).toEqual([]);
    });

    it('폴더가 4개 이상이고 3개 이상 저장 이력이 있으면 최근 3개를 내림차순으로 반환한다', () => {
      // 4개부터는 "내 폴더"가 최근 구획(3개 고정 상한)보다 항상 많아 완전 일치가
      // 구조적으로 불가능하다 — split menu 본연의 스캔 비용 절감 효과가 유효하다.
      const folders = [1, 2, 3, 4].map((n) =>
        makeFolder({ id: `f${n}`, lastUsedAt: `2025-01-0${n}` })
      );

      expect(BookmarkFolderUtil.pickRecentFolders(folders).map((f) => f.id)).toEqual([
        'f4',
        'f3',
        'f2',
      ]);
    });

    it('저장 이력이 없는 폴더는 후보에서 제외한다', () => {
      const folders = [
        makeFolder({ id: 'f1', lastUsedAt: '2025-01-01' }),
        makeFolder({ id: 'f2', lastUsedAt: '2025-01-02' }),
        makeFolder({ id: 'f3', lastUsedAt: '2025-01-03' }),
        makeFolder({ id: 'f4' }),
        makeFolder({ id: 'f5' }),
      ];

      expect(BookmarkFolderUtil.pickRecentFolders(folders).map((f) => f.id)).toEqual([
        'f3',
        'f2',
        'f1',
      ]);
    });
  });
});
