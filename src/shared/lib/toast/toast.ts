import { toast as sonnerToast, type ExternalToast } from 'sonner';
import { resolveActionLayout, STACKED_ACTION_CLASS_NAMES } from '@/shared/lib/toast/toast-layout';

/**
 * 토스트 위치 정책 — 카테고리별로 위치를 다르게 둔다.
 * - 성공/액션 확인: 방금 한 행동의 결과이므로 손가락(모바일)·시선(데스크탑)에 가까운 하단.
 * - 진행 중(loading): 곧 성공/실패 토스트로 교대될 결과 계열이라 성공과 같은 하단.
 * - 오류/경고/시스템 알림: 주의를 끌어야 하므로 상단.
 */
const SUCCESS_POSITION = 'bottom-center' as const;
const ALERT_POSITION = 'top-center' as const;

type ToastPosition = typeof SUCCESS_POSITION | typeof ALERT_POSITION;
type ToastMessage = Parameters<typeof sonnerToast>[0];

/**
 * 호출부가 넘길 수 있는 옵션 - 모양을 바꾸는 옵션(배치 클래스·닫기 X 유무)은 뺐다. 버튼(action)이 달린 토스트의
 * 배치는 래퍼가 정해, 스토리북에 없는 모양이 호출부에서 만들어지지 않는다(docs/FE-ARCHITECTURE.md §14 "버튼 배치").
 */
export type ToastOptions = Omit<
  ExternalToast,
  'classNames' | 'className' | 'style' | 'closeButton' | 'unstyled'
> & {
  /**
   * `shared/lib/toast/` 안의 토스트 전용 - 래퍼가 정한 배치 클래스 위에 합친다. 밖에서 쓰면 ESLint
   * `custom-import/no-toast-unsafe-class-names`가 막는다(이름은 React Spectrum `UNSAFE_className`을 따랐다).
   */
  UNSAFE_classNames?: ExternalToast['classNames'];
};

// 호출자가 명시한 옵션(예: PostDetailPage의 dedup id)이 항상 정책 기본값을 이긴다.
const at = (
  position: ToastPosition,
  message: ToastMessage,
  options?: ToastOptions
): ExternalToast => {
  // 타입은 객체 리터럴만 막는다 - 변수·스프레드로 넘어온 모양 옵션은 여기서 버린다
  const {
    UNSAFE_classNames,
    classNames: _classNames,
    className: _className,
    style: _style,
    closeButton: _closeButton,
    unstyled: _unstyled,
    ...rest
  } = (options ?? {}) as ToastOptions & ExternalToast;
  const layout = resolveActionLayout(message, rest);
  const classNames = {
    ...(layout === 'stacked' && STACKED_ACTION_CLASS_NAMES),
    ...UNSAFE_classNames,
  };

  return {
    position,
    ...rest,
    ...(layout === 'inline' && { closeButton: false }),
    ...(Object.keys(classNames).length > 0 && { classNames }),
  };
};

// 토스트 폭(sonner 기본 356px)에 한 줄 30자 남짓이라 두 문장 문구는 뒷문장 중간에서 줄이 넘어간다.
// 문장 끝(한글 바로 뒤 . ? !) 다음 공백을 줄바꿈으로 바꿔 문장 끝에서만 줄이 바뀌게 한다 — sonner.tsx의
// title `whitespace-pre-line`이 있어야 줄바꿈으로 보인다. 한글 뒤로 좁힌 건 닉네임 안내의 "_ . -"·소수점·
// URL을 건드리지 않으려고, lookbehind 대신 캡처 그룹을 쓴 건 빌드 타깃 safari14가 lookbehind를 지원하지
// 않아서다(Safari 16.4부터, https://caniuse.com/js-regexp-lookbehind).
const breakSentences = (message: ToastMessage): ToastMessage =>
  typeof message === 'string' ? message.replace(/([가-힣][.?!])\s+/g, '$1\n') : message;

// 줄바꿈을 거친 문구로 배치를 정한다(두 문장 문구는 여기서 두 줄이 된다)
const build = (
  position: ToastPosition,
  message: ToastMessage,
  options?: ToastOptions
): [ToastMessage, ExternalToast] => {
  const broken = breakSentences(message);

  return [broken, at(position, broken, options)];
};

/**
 * sonner `toast`의 래퍼 — 카테고리별 위치를 주입하고, 문자열 메시지는 문장마다 줄을 바꾸고, 버튼(action)이 달리면
 * 배치를 정한다(toast-layout.ts).
 * 호출부는 `sonner` 대신 이 모듈을 import한다 (ESLint custom-import/no-sonner-toast-direct-import로 강제).
 */
export const toast = Object.assign(
  (message: ToastMessage, options?: ToastOptions) =>
    sonnerToast(...build(ALERT_POSITION, message, options)),
  {
    success: (message: ToastMessage, options?: ToastOptions) =>
      sonnerToast.success(...build(SUCCESS_POSITION, message, options)),
    loading: (message: ToastMessage, options?: ToastOptions) =>
      sonnerToast.loading(...build(SUCCESS_POSITION, message, options)),
    error: (message: ToastMessage, options?: ToastOptions) =>
      sonnerToast.error(...build(ALERT_POSITION, message, options)),
    warning: (message: ToastMessage, options?: ToastOptions) =>
      sonnerToast.warning(...build(ALERT_POSITION, message, options)),
    info: (message: ToastMessage, options?: ToastOptions) =>
      sonnerToast.info(...build(ALERT_POSITION, message, options)),
    dismiss: sonnerToast.dismiss,
  }
);
