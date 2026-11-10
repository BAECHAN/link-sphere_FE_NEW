/**
 * 뒤로가기로 닫히는 오버레이(시트·창)의 등록부. 열림은 같은 주소의 히스토리 칸에 이 키를 실어 둔다
 * (shared/hooks/useBackClosableOverlay.ts). 키를 더하면 e2e/back-closable-overlay.cases.ts에 그 오버레이의
 * 사례를 적기 전까지 type-check가 실패한다 - 실제 뒤로가기로 검사하지 않은 오버레이가 들어오지 않게 한다
 * (docs/BACK-NAVIGATION.md).
 */
export type BackClosableOverlayKey =
  /** 카드 북마크 버튼의 폴더 선택 창 */
  | 'bookmarkFolderDialogOpen'
  /** 글 등록 폼의 폴더 선택 창 */
  | 'postCreateBookmarkFolderOpen';
