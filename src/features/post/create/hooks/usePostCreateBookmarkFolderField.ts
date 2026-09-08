import { useState } from 'react';
import { useController, useFormContext } from 'react-hook-form';
import { TEXTS } from '@/shared/config/texts';
import { useFolderListQuery } from '@/entities/bookmark/folder/api/folder.queries';
import type { Folder } from '@/entities/bookmark/folder/model/folder.schema';
import type { CreatePost } from '@/entities/post/model/post.schema';

/**
 * PostCreateBookmarkFolderField의 로직 전부 — 등록 폼의 bookmark/folderIds 필드 제어,
 * 트리거 버튼 표시 문구, 지연 선택 핸들러(탭해도 즉시 저장하지 않고 폼 값만 바꿈)를
 * 소유한다.
 */
export function usePostCreateBookmarkFolderField() {
  const { control } = useFormContext<CreatePost>();
  const { field: bookmarkField } = useController<CreatePost, 'bookmark'>({
    name: 'bookmark',
    control,
  });
  const { field: folderIdsField } = useController<CreatePost, 'folderIds'>({
    name: 'folderIds',
    control,
  });

  const bookmark = bookmarkField.value;
  const folderIds = folderIdsField.value;

  const [open, setOpen] = useState(false);
  // 모달이 닫혀 있을 때도 트리거에 폴더명을 보여줘야 해 여기서도 목록을 읽는다.
  // FolderPickerModal 내부 호출과 같은 쿼리 키라 요청·캐시가 공유된다.
  const { data } = useFolderListQuery({ enabled: open });
  const folderList = Array.isArray(data?.folders) ? data.folders : [];

  const applySelection = (nextBookmark: boolean, nextFolderIds: string[]) => {
    bookmarkField.onChange(nextBookmark);
    folderIdsField.onChange(nextFolderIds);
  };

  const handleSelectUncategorized = () => {
    applySelection(true, []);
  };

  const handleSelectFolder = (folder: Folder) => {
    if (folderIds.includes(folder.id)) {
      const next = folderIds.filter((id) => id !== folder.id);
      // 마지막 폴더에서 빠져도 미분류로 남는다(북마크 자체는 유지) — PostCardBookmarkFolderModal과 동일 규칙.
      applySelection(true, next);
    } else {
      applySelection(true, [...folderIds, folder.id]);
    }
  };

  // 목록 맨 아래 '북마크 안 함' 행 — 항상 노출한다. 조건부로 감추면 탭할 때마다 행이
  // 나타났다 사라지며 위의 '확인' 버튼 위치가 흔들린다. 다른 행과 달리 더 고를 게 없는
  // 종결 동작이라(보관함 모달의 '북마크 제거' 행과 동일) 누르면 바로 닫는다.
  const handleClearBookmark = () => {
    if (bookmark || folderIds.length > 0) {
      applySelection(false, []);
    }
    setOpen(false);
  };

  const selectedFolderNames = folderList
    .filter((folder) => folderIds.includes(folder.id))
    .map((folder) => folder.name);

  const triggerText =
    selectedFolderNames.length > 0
      ? selectedFolderNames.join(', ')
      : bookmark
        ? TEXTS.bookmark.folder.uncategorized
        : TEXTS.post.form.create.bookmarkNone;

  return {
    bookmark,
    folderIds,
    open,
    setOpen,
    triggerText,
    handleSelectUncategorized,
    handleSelectFolder,
    handleClearBookmark,
  };
}
