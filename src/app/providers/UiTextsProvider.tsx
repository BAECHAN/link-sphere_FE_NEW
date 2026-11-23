import { ReactNode } from 'react';
import { TEXTS } from '@/shared/config/texts';
import { UiTextsProvider as BaseUiTextsProvider } from '@baechan/ui/texts/UiTextsProvider';
import type { UiTexts } from '@baechan/ui/texts/ui-texts';

/**
 * 범용 공용 UI 부품이 스스로 보여 주는 글자(닫기, 확인, 취소 등)를 이 앱의 문구 파일에서 뽑은 것.
 * 부품은 앱 문구 파일을 import하지 않고 이 값을 컨텍스트로 받는다(docs/DESIGN-SYSTEM-PRINCIPLES.md §1).
 * 문구를 정하는 곳은 지금처럼 `texts.ts`다 - 패키지의 한국어 묶음(`KO_UI_TEXTS`)과 어긋나면
 * UiTextsProvider.test.tsx가 실패한다.
 */
export const APP_UI_TEXTS: UiTexts = {
  common: {
    close: TEXTS.ariaLabels.close,
  },
  alertDialog: {
    confirm: TEXTS.buttons.confirm,
    cancel: TEXTS.buttons.cancel,
    fallbackTitle: TEXTS.ariaLabels.alertDialogFallbackTitle,
  },
  input: {
    clear: TEXTS.ariaLabels.inputClear,
  },
  passwordInput: {
    show: TEXTS.ariaLabels.showPassword,
    hide: TEXTS.ariaLabels.hidePassword,
  },
  spinner: {
    label: TEXTS.ariaLabels.loading,
  },
  backToTopButton: {
    label: TEXTS.ariaLabels.backToTop,
  },
  imageAttachmentField: {
    attach: TEXTS.comment.form.attachImage,
    hint: TEXTS.comment.form.attachHint,
    removeAt: TEXTS.comment.form.removeImageAt,
    imageAt: TEXTS.ariaLabels.attachmentImageAt,
  },
  dropTargetOverlay: {
    message: TEXTS.comment.form.dropHere,
  },
  loadMoreError: {
    failed: TEXTS.messages.error.loadMoreFailed,
    retry: TEXTS.buttons.retry,
  },
  imageViewer: {
    title: TEXTS.ariaLabels.imageViewer,
    description: TEXTS.ariaLabels.imageViewerDescription,
    prev: TEXTS.ariaLabels.imageViewerPrev,
    next: TEXTS.ariaLabels.imageViewerNext,
  },
  authLayout: {
    root: TEXTS.ariaLabels.authLayout,
    content: TEXTS.ariaLabels.authContent,
  },
  errorLayout: {
    root: TEXTS.ariaLabels.errorLayout,
    content: TEXTS.ariaLabels.errorContent,
    detail: TEXTS.ariaLabels.errorDetail,
  },
};

export function UiTextsProvider({ children }: { children: ReactNode }) {
  return <BaseUiTextsProvider texts={APP_UI_TEXTS}>{children}</BaseUiTextsProvider>;
}
