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
  | 'postCreateBookmarkFolderOpen'
  /** 폰의 왼쪽 메뉴 */
  | 'sidebarOpen'
  /** 로그인 창 */
  | 'loginDialogOpen'
  /** 이미지 확대 창 */
  | 'imageViewerOpen'
  /** 폰의 검색창 */
  | 'mobileSearchOpen';

/**
 * 오버레이를 여는 칸에 싣는 state. 훅을 쓸 수 없는 자리(React 트리 밖의 유틸, <Navigate>)에서 칸을 직접 넣을 때도
 * 이 함수로 만든다 - 키를 리터럴로 적으면 등록부와 따로 놀아, 이름이 바뀌어도 컴파일이 통과한다(린트가 막는다).
 */
export function createBackClosableOverlayState<Key extends BackClosableOverlayKey>(key: Key) {
  return { [key]: true } as Record<Key, true>;
}
