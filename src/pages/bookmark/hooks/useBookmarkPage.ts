import { useEffect } from 'react';
import { useSearchParamsDraft } from '@/shared/hooks/useSearchParamsDraft';
import { useIsMobile } from '@/shared/hooks/useIsMobile';
import { TEXTS } from '@/shared/config/texts';
import {
  BookmarkFolderKey,
  BookmarkFolderSort,
} from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import { useBookmarkFolderListQuery } from '@/entities/bookmark/folder/api/bookmark-folder.queries';

export const VALID_SORTS: BookmarkFolderSort[] = ['latest', 'oldest', 'title', 'views', 'viewed'];

function parseFolderKey(raw: string | null): BookmarkFolderKey | null {
  if (!raw) {
    return null;
  }

  if (raw === 'uncategorized' || raw === 'all') {
    return raw;
  }

  return raw; // UUID assumed
}

function parseSort(raw: string | null): BookmarkFolderSort {
  if (raw && (VALID_SORTS as string[]).includes(raw)) {
    return raw as BookmarkFolderSort;
  }

  return 'latest';
}

export function useBookmarkPage() {
  const isMobile = useIsMobile();
  const { searchParams, updateSearchParams } = useSearchParamsDraft();

  const folderParam = searchParams.get('folder');
  const folderKey = parseFolderKey(folderParam);
  const sort = parseSort(searchParams.get('sort'));
  const search = searchParams.get('q') ?? '';

  const { data: folderData } = useBookmarkFolderListQuery();
  const folderList = folderData?.folders;

  // 모바일: folder 쿼리 없으면 폴더 목록 모드 / 데스크탑: 항상 'all' 디폴트
  const isMobileListMode = isMobile && !folderKey;
  const activeFolderKey: BookmarkFolderKey = folderKey ?? 'all';

  const currentFolderName =
    activeFolderKey === 'all'
      ? TEXTS.bookmark.folder.all
      : activeFolderKey === 'uncategorized'
        ? TEXTS.bookmark.folder.uncategorized
        : (folderList?.find((f) => f.id === activeFolderKey)?.name ??
          TEXTS.bookmark.folder.fallbackName);

  const setFolderKey = (key: BookmarkFolderKey) => {
    updateSearchParams(
      (draft) => {
        if (key === 'all' && !isMobile) {
          draft.delete('folder');
        } else {
          draft.set('folder', key);
        }
      },
      { replace: false }
    );
  };

  const setSort = (next: BookmarkFolderSort) => {
    updateSearchParams(
      (draft) => {
        if (next === 'latest') {
          draft.delete('sort');
        } else {
          draft.set('sort', next);
        }
      },
      { replace: true }
    );
  };

  const goToFolderList = () => {
    updateSearchParams(
      (draft) => {
        draft.delete('folder');
      },
      { replace: false }
    );
  };

  // 삭제됐거나 존재하지 않는 폴더 UUID가 URL에 남으면 → 전체로 리다이렉트 (404 FOLDER_NOT_FOUND 방지)
  useEffect(
    function redirectWhenFolderMissing() {
      if (!folderList) {
        return;
      }

      if (!folderKey || folderKey === 'all' || folderKey === 'uncategorized') {
        return;
      }

      if (folderList.some((f) => f.id === folderKey)) {
        return;
      }

      updateSearchParams(
        (draft) => {
          draft.delete('folder');
        },
        { replace: true }
      );
    },
    [folderList, folderKey, updateSearchParams]
  );

  return {
    isMobile,
    isMobileListMode,
    activeFolderKey,
    currentFolderName,
    sort,
    search,
    setFolderKey,
    setSort,
    goToFolderList,
  };
}
