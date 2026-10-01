import { useQueryClient } from '@tanstack/react-query';
import { useController, useFormContext } from 'react-hook-form';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { TEXTS } from '@/shared/config/texts';
import {
  prefetchBookmarkFolderList,
  useBookmarkFolderListQuery,
} from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import type { BookmarkFolder } from '@/entities/bookmark/folder/model/bookmark-folder.schema';
import type { CreatePost } from '@/entities/post/model/post.schema';

/**
 * PostCreateBookmarkFolderField의 로직 전부 — 등록 폼의 bookmark/folderIds 필드 제어,
 * 트리거 버튼 표시 문구, 지연 선택 핸들러(탭해도 즉시 저장하지 않고 폼 값만 바꿈)를
 * 소유한다.
 */
export function usePostCreateBookmarkFolderField() {
  const queryClient = useQueryClient();
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

  // 열림 상태는 같은 경로의 히스토리 엔트리로 둔다 — 모달을 연 채 뒤로가기를 누르면 페이지가
  // 아니라 모달만 닫힌다(docs/DECISIONS.md 2026-08-07 뒤로가기 정책 T1, 카드 북마크 버튼의
  // useBookmarkPostButton과 같은 방식). 같은 경로 안의 이동이라 이탈 확인
  // (useUnsavedChangesGuard)은 뜨지 않는다.
  const {
    isOpen: open,
    open: openOverlay,
    close,
  } = useHistoryOverlay('postCreateBookmarkFolderOpen');

  const setOpen = (next: boolean) => {
    if (next) {
      openOverlay();
      return;
    }

    close();
  };

  // 모달이 닫혀 있을 때도 트리거에 폴더명을 보여줘야 해 여기서도 목록을 읽는다.
  // BookmarkFolderSelectDialog 내부 호출과 같은 쿼리 키라 요청·캐시가 공유된다.
  const { data } = useBookmarkFolderListQuery({ enabled: open });
  const folderList = Array.isArray(data?.folders) ? data.folders : [];

  // 트리거 hover/focus 때 목록을 미리 받아, 열 때 로딩 골격 없이 바로 보이게 한다(카드
  // 북마크 버튼의 useBookmarkPostButton과 같은 방식). 화면 진입 시점에 받지 않는 건 북마크를
  // 안 쓰고 등록만 하는 경우에도 매번 요청이 나가서다(docs/BOOKMARK.md §5). /post/submit은
  // ProtectedRoute 아래라 카드 버튼과 달리 로그인 여부를 따로 확인하지 않는다.
  const handlePrefetch = () => {
    prefetchBookmarkFolderList(queryClient);
  };

  const applySelection = (nextBookmark: boolean, nextFolderIds: string[]) => {
    bookmarkField.onChange(nextBookmark);
    folderIdsField.onChange(nextFolderIds);
  };

  const handleSelectUncategorized = () => {
    // 이미 미분류(체크됨)면 handleSelectFolder의 마지막 폴더 규칙과 대칭으로 "북마크 안
    // 함"으로 되돌린다(2026-09-11 변경). 제출 전 폼 값만 바뀌는 지연 선택이라 API 호출이
    // 없고, 다시 탭하면 바로 되돌아가므로 되돌리기 토스트도 불필요하다.
    const isAlreadyUncategorized = bookmark && folderIds.length === 0;

    if (isAlreadyUncategorized) {
      applySelection(false, []);
      return;
    }
    applySelection(true, []);
  };

  const handleSelectFolder = (folder: BookmarkFolder) => {
    if (folderIds.includes(folder.id)) {
      const next = folderIds.filter((id) => id !== folder.id);
      // 마지막 폴더에서 빠지면 미분류로 남기지 않고 북마크 안 함으로 되돌린다
      // (2026-09-11 변경 — PostCardBookmarkFolderDialog의 완전 삭제 규칙과 동일).
      // 제출 전 폼 값만 바뀌는 지연 선택이라 API 호출이 없고, 미분류 행을 다시 탭하면
      // 바로 되돌아가므로 되돌리기 토스트도 불필요하다.
      applySelection(next.length > 0, next);
    } else {
      applySelection(true, [...folderIds, folder.id]);
    }
  };

  // 목록 맨 아래 '북마크 안 함' 행 — 항상 노출한다. 조건부로 감추면 탭할 때마다 행이
  // 나타났다 사라지며 위의 '확인' 버튼 위치가 흔들린다. 다른 행과 달리 더 고를 게 없는
  // 종결 동작이라(카드 북마크 모달의 '북마크 제거' 행과 동일) 누르면 바로 닫는다.
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
    handlePrefetch,
    handleSelectUncategorized,
    handleSelectFolder,
    handleClearBookmark,
  };
}
