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

/**
 * sonner `toast`와 동일한 시그니처의 래퍼 — 카테고리별 위치를 주입한다.
 * 호출부는 `sonner` 대신 이 모듈을 import한다 (ESLint no-restricted-imports로 강제).
 */
export const toast = Object.assign(
  (message: ToastMessage, options?: ExternalToast) =>
    sonnerToast(message, at(ALERT_POSITION, options)),
  {
    success: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.success(message, at(SUCCESS_POSITION, options)),
    loading: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.loading(message, at(SUCCESS_POSITION, options)),
    error: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.error(message, at(ALERT_POSITION, options)),
    warning: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.warning(message, at(ALERT_POSITION, options)),
    info: (message: ToastMessage, options?: ExternalToast) =>
      sonnerToast.info(message, at(ALERT_POSITION, options)),
    dismiss: sonnerToast.dismiss,
  }
);
