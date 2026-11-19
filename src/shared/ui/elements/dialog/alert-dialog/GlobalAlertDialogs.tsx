import { useEffect, useRef } from 'react';
import {
  AlertDialogData,
  useAlertDialogStore,
} from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';
import { useShallow } from 'zustand/react/shallow';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/shared/ui/atoms/alert-dialog';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { useUiTexts } from '@/shared/ui/texts/UiTextsProvider';

interface AlertDialogItemProps {
  dialog: AlertDialogData;
  dismissKey: string | undefined;
}

function AlertDialogItem({ dialog, dismissKey }: AlertDialogItemProps) {
  const uiTexts = useUiTexts();
  const { close, remove, cancelAlertDialog } = useAlertDialogStore(
    useShallow((state) => ({
      close: state.close,
      remove: state.remove,
      cancelAlertDialog: state.cancelAlertDialog,
    }))
  );

  // 열릴 때 포커스를 받을 버튼 - 확인창(confirm)은 취소 버튼, 버튼이 하나인 알림(alert)은 확인
  // 버튼이다. Radix AlertDialog의 기본 오토포커스는 Cancel 부품(이 앱에서는 닫기 X)으로 가므로
  // 여기서 직접 준다.
  const initialFocusRef = useRef<HTMLButtonElement>(null);

  const {
    id,
    title,
    message,
    confirmText = uiTexts.alertDialog.confirm,
    cancelText = uiTexts.alertDialog.cancel,
    type,
    isOpen,
  } = dialog;

  const handleConfirm = () => {
    // close()를 onConfirm()보다 먼저 호출한다 - onConfirm이 동기적으로 같은 pathname
    // 네비게이션을 트리거하는 경우(예: 폴더 삭제의 onBeforeDelete), 순서가 반대면 그
    // 네비게이션이 "아직 안 닫힌 이 확인창" 때문에 useUnsavedChangesGuard에 막혔다가,
    // 막힌 걸 정리하는 이펙트가 실행되는 시점엔 이미 확인창이 닫혀 있어 "열린 확인창 때문에
    // 막혔다"는 분기를 못 타고 엉뚱한 "저장하지 않은 변경사항" 확인창을 새로 띄워버린다
    // (실측: 폴더 삭제 시 확인 버튼을 눌러도 즉시 반영되지 않고 이 확인창이 한 번 더 떴다).
    close(id);
    dialog.onConfirm?.();
    setTimeout(() => remove(id), 300);
  };

  // 취소 버튼 클릭과 오버레이 바깥에서의 취소(뒤로가기 등)가 같은 동작이라 스토어 액션 하나로 합친다.
  const handleCancel = () => cancelAlertDialog(id);
  const handleClose = () => cancelAlertDialog(id);

  // 히스토리에 묶이지 않은 대화상자라 뒤로가기가 라우트만 바꿔도 알아채지 못하고 배경만
  // 바뀐 채로 계속 떠 있는다 - 열려있던 위치를 벗어나면 취소로 간주해 닫는다.
  // 위치를 아는 것은 쓰는 쪽이다 - 이 부품은 라우터를 import하지 않고 "바뀌면 닫을 값"만 받는다.
  // 이 앱은 RouteAlertDialogs가 location.key를 넘긴다. pathname이 아니라 key인 이유는 북마크
  // 페이지처럼 폴더 이동이 쿼리 파라미터로만 표현되면 pathname은 안 바뀌지만 key는 navigate마다
  // 항상 새로 발급되기 때문이다.
  const openedKeyRef = useRef(dismissKey);
  useEffect(() => {
    if (isOpen && dismissKey !== openedKeyRef.current) {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissKey]);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      {/* 확인창은 명시적인 응답을 받는 창이라 바깥 클릭으로 닫지 않는다 — Radix AlertDialog가
          항상 막는다. 취소 버튼·X·ESC·뒤로가기로는 닫힌다(docs/DECISIONS.md 2026-09-30). */}
      <AlertDialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-[400px]"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          initialFocusRef.current?.focus();
        }}
      >
        <AlertDialogHeader className="items-center text-center">
          {title ? (
            <AlertDialogTitle>{title}</AlertDialogTitle>
          ) : (
            <AlertDialogTitle className="sr-only">
              {uiTexts.alertDialog.fallbackTitle}
            </AlertDialogTitle>
          )}
          <AlertDialogDescription
            className={cn('text-center text-foreground font-medium', !title && 'pt-4')}
          >
            {typeof message === 'string' ? (
              <span className="whitespace-pre-wrap">{message.replace(/([.?])\s+/g, '$1\n')}</span>
            ) : (
              message
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row justify-center gap-2 sm:justify-center mt-2">
          {/* 모든 확인창이 같은 모양이다 - 취소 쪽이 흰색(outline)·왼쪽·초기 포커스, 창이 묻는
              행동이 검은색(채움)·오른쪽이다. 그래서 열린 직후 Enter와 Esc·X·뒤로가기는 모두
              취소다. 호출부는 이 모양을 바꿀 수 없고 문구만 넘긴다. 같은 부품에서 흰색·왼쪽
              버튼의 뜻이 창마다 달라 "취소"로 알고 누른 버튼이 화면을 떠나게 한 실수가 계기다.
              GlobalAlertDialogs.test.tsx "기본 규칙"과 스토리 Confirm의 play가 이 모양을 지킨다.
              근거: docs/FE-ARCHITECTURE.md §10, docs/DECISIONS.md 2026-11-19 */}
          {type === 'confirm' && (
            <Button
              variant="outline"
              onClick={handleCancel}
              ref={initialFocusRef}
              className="flex-1 sm:flex-none sm:min-w-[80px]"
            >
              {cancelText}
            </Button>
          )}
          <Button
            onClick={handleConfirm}
            ref={type === 'alert' ? initialFocusRef : undefined}
            className="flex-1 sm:flex-none sm:min-w-[80px]"
          >
            {confirmText}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface GlobalAlertDialogsProps {
  /**
   * 이 값이 바뀌면 열려 있던 확인창을 취소로 닫는다. 화면이 바뀌었는데 확인창만 남는 것을 막는 용도라
   * 라우터를 쓰는 앱은 위치마다 달라지는 값(react-router의 `location.key` 등)을 넘긴다.
   * 넘기지 않으면 이 이유로는 닫히지 않는다.
   */
  dismissKey?: string;
}

/**
 * 전역 Alert/Confirm 모달 렌더러
 * App 최상위에 배치하여 사용합니다.
 */
export function GlobalAlertDialogs({ dismissKey }: GlobalAlertDialogsProps) {
  const dialogs = useAlertDialogStore((state) => state.dialogs);

  return (
    <>
      {dialogs.map((dialog) => (
        <AlertDialogItem key={dialog.id} dialog={dialog} dismissKey={dismissKey} />
      ))}
    </>
  );
}
