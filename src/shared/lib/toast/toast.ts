import { toast as sonnerToast, type ExternalToast } from 'sonner';

/**
 * 토스트 위치 정책 — 카테고리별로 위치를 다르게 둔다.
 * - 성공/액션 확인: 방금 한 행동의 결과이므로 손가락(모바일)·시선(데스크탑)에 가까운 하단.
 * - 진행 중(loading): 곧 성공/실패 토스트로 교대될 결과 계열이라 성공과 같은 하단.
 * - 오류/경고/시스템 알림: 주의를 끌어야 하므로 상단.
 */
const SUCCESS_POSITION = 'bottom-center' as const;
const ALERT_POSITION = 'top-center' as const;

type ToastMessage = Parameters<typeof sonnerToast>[0];

// 호출자가 명시한 옵션(예: PostDetailPage의 dedup id)이 항상 정책 기본값을 이긴다.
const at = (
  position: typeof SUCCESS_POSITION | typeof ALERT_POSITION,
  options?: ExternalToast
): ExternalToast => ({
  position,
  ...options,
});

// 토스트 폭(sonner 기본 356px)에 한 줄 30자 남짓이라 두 문장 문구는 뒷문장 중간에서 줄이 넘어간다.
// 문장 끝(한글 바로 뒤 . ? !) 다음 공백을 줄바꿈으로 바꿔 문장 끝에서만 줄이 바뀌게 한다 — sonner.tsx의
// title `whitespace-pre-line`이 있어야 줄바꿈으로 보인다. 한글 뒤로 좁힌 건 닉네임 안내의 "_ . -"·소수점·
// URL을 건드리지 않으려고, lookbehind 대신 캡처 그룹을 쓴 건 빌드 타깃 safari14가 lookbehind를 지원하지
// 않아서다(Safari 16.4부터, https://caniuse.com/js-regexp-lookbehind).
const breakSentences = (message: ToastMessage): ToastMessage =>
  typeof message === 'string' ? message.replace(/([가-힣][.?!])\s+/g, '$1\n') : message;

/**
 * sonner `toast`와 동일한 시그니처의 래퍼 — 카테고리별 위치를 주입하고 문자열 메시지는 문장마다 줄을 바꾼다.
 * 호출부는 `sonner` 대신 이 모듈을 import한다 (ESLint custom-import/no-sonner-toast-direct-import로 강제).
 */
export const toast = Object.assign(
  (message: ToastMessage, options?: ExternalToast) =>
    sonnerToast(breakSentences(message), at(ALERT_POSITION, options)),
  {
    success: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.success(breakSentences(message), at(SUCCESS_POSITION, options)),
    loading: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.loading(breakSentences(message), at(SUCCESS_POSITION, options)),
    error: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.error(breakSentences(message), at(ALERT_POSITION, options)),
    warning: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.warning(breakSentences(message), at(ALERT_POSITION, options)),
    info: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.info(breakSentences(message), at(ALERT_POSITION, options)),
    dismiss: sonnerToast.dismiss,
  }
);
