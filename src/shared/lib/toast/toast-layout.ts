import type { ExternalToast } from 'sonner';

/**
 * 버튼(action)이 달린 토스트의 배치 - 호출부가 아니라 래퍼(toast.ts)가 정한다(docs/FE-ARCHITECTURE.md §14 "버튼 배치").
 * - `stacked`: 문구가 여러 줄이면 버튼을 문구 아래 줄 오른쪽에, 닫기 X를 오른쪽 위에 둔다
 * - `inline`: 문구가 한 줄이면 버튼을 같은 줄 오른쪽에 두고 닫기 X를 끈다(버튼과 X가 자리를 다툰다)
 * - `none`: 버튼이 없다
 *
 * 이름은 MDC Web `mdc-snackbar--stacked`, Primer `actionsLayout: 'inline' | 'stacked'`를 따랐다.
 */
export type ToastActionLayout = 'none' | 'inline' | 'stacked';

// 버튼을 문구 아래 오른쪽으로 내리고 닫기 X는 오른쪽 위, 아이콘은 첫 줄에 맞춘다(근거·미리보기 승인:
// docs/UNSAVED-CHANGES-GUARD.md §5). sonner는 버튼에 자체 CSS(속성 선택자)를 걸고, Toaster(sonner.tsx)의 기본
// 클래스와 단순히 이어 붙여 important로 덮는다 - node_modules/sonner/dist/styles.css:127-199
export const STACKED_ACTION_CLASS_NAMES = {
  toast: '!grid grid-cols-[auto_minmax(0,1fr)_auto] !items-start gap-x-3 gap-y-3',
  icon: 'col-start-1 row-start-1 mt-0.5',
  content: 'col-start-2 row-start-1 min-w-0',
  actionButton: 'col-start-2 col-span-2 row-start-2 justify-self-end !ml-0',
  closeButton: 'col-start-3 row-start-1 !ml-0',
};

/**
 * 화면 폭을 재지 않고 호출 시점에 정한다 - 설명이 있거나, 문장 줄바꿈을 거친 문구가 두 줄 이상이면 여러 줄이다.
 * 문구가 문자열이 아니면 줄 수를 알 수 없어 여러 줄로 본다.
 */
export function resolveActionLayout(
  message: unknown,
  options?: Pick<ExternalToast, 'action' | 'description'>
): ToastActionLayout {
  if (!options?.action) {
    return 'none';
  }

  const isMultiLine =
    Boolean(options.description) || typeof message !== 'string' || message.includes('\n');

  return isMultiLine ? 'stacked' : 'inline';
}
