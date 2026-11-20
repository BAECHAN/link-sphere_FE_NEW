/**
 * 공용 UI 부품이 스스로 보여 주는 글자(닫기 라벨, 로딩 라벨 등)의 모양.
 *
 * 범용 부품은 앱 문구 파일(`TEXTS`)을 import하지 않고 `useUiTexts()`로 이 값을 읽는다 - 앱 문구에 묶이면
 * 다른 프로젝트에서 쓸 수 없다. 글자 자체는 여기 없다. 쓰는 쪽이 맨 위에서 `UiTextsProvider`로 전부 넘긴다
 * (이 앱: `src/app/providers/UiTextsProvider.tsx`, 문구를 정하는 곳은 `src/shared/config/texts.ts`).
 *
 * 묶는 규칙: 한 부품만 쓰는 글자는 그 부품 이름 아래, 둘 이상이 쓰면 `common`.
 * 근거: docs/DESIGN-SYSTEM-PRINCIPLES.md §1
 */
export interface UiTexts {
  common: {
    // Dialog, AlertDialog, ImageViewer의 닫기 버튼
    close: string;
  };
  alertDialog: {
    confirm: string;
    cancel: string;
    // 제목 없는 확인창의 접근 이름 - 화면에는 안 보인다
    fallbackTitle: string;
  };
  input: {
    clear: string;
  };
  passwordInput: {
    show: string;
    hide: string;
  };
  spinner: {
    label: string;
  };
  backToTopButton: {
    label: string;
  };
  imageAttachmentField: {
    attach: string;
    hint: string;
    removeAt: (order: number) => string;
    imageAt: (order: number) => string;
  };
  dropTargetOverlay: {
    message: string;
  };
  // 목록 끝에서 다음 묶음을 받지 못했을 때
  loadMoreError: {
    failed: string;
    retry: string;
  };
  imageViewer: {
    // 확대 창의 접근 이름과 설명 - 화면에는 안 보인다
    title: string;
    description: string;
    prev: string;
    next: string;
  };
  // 레이아웃 영역의 접근 이름
  authLayout: {
    root: string;
    content: string;
  };
  errorLayout: {
    root: string;
    content: string;
    detail: string;
  };
}
