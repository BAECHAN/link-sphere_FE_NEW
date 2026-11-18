import type { UiTexts } from '@/shared/ui/texts/ui-texts';

/**
 * 한국어 문구 묶음 - 부품 문구를 직접 적지 않으려는 프로젝트가 가져다 `UiTextsProvider`에 넘기는 양식.
 * 자동으로 쓰이지 않는다. 넘기지 않으면 부품은 오류를 낸다(`useUiTexts`).
 *
 * 이 앱은 이 묶음을 쓰지 않고 자기 문구(`TEXTS`)를 넘긴다. 둘이 어긋나면
 * `src/app/providers/UiTextsProvider.test.tsx`가 실패한다.
 */
export const KO_UI_TEXTS: UiTexts = {
  common: {
    close: '닫기',
  },
  alertDialog: {
    confirm: '확인',
    cancel: '취소',
    fallbackTitle: '알림',
  },
  input: {
    clear: '입력값 지우기',
  },
  passwordInput: {
    show: '비밀번호 보기',
    hide: '비밀번호 숨기기',
  },
  spinner: {
    label: '불러오는 중',
  },
  backToTopButton: {
    label: '맨 위로',
  },
  imageAttachmentField: {
    attach: '이미지 첨부',
    hint: '클릭·드래그·붙여넣기로 이미지 첨부',
    removeAt: (order) => `이미지 ${order} 삭제`,
    imageAt: (order) => `첨부 이미지 ${order}`,
  },
  dropTargetOverlay: {
    message: '이미지를 여기에 놓으세요',
  },
  loadMoreError: {
    failed: '더 불러오지 못했어요.',
    retry: '다시 시도',
  },
  authLayout: {
    root: '인증 레이아웃',
    content: '인증 컨텐츠',
  },
  errorLayout: {
    root: '에러 레이아웃',
    content: '에러 컨텐츠',
    detail: '에러 상세 정보',
  },
};
