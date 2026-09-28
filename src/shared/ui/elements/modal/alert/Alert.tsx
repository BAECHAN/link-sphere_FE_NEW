import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AlertData, useAlertStore } from '@/shared/ui/elements/modal/alert/alert.store';
import { useShallow } from 'zustand/react/shallow';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/atoms/dialog';
import { Button } from '@/shared/ui/atoms/button';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';

interface AlertProps {
  alert: AlertData;
}

function Alert({ alert }: AlertProps) {
  const { close, remove, cancelAlert } = useAlertStore(
    useShallow((state) => ({
      close: state.close,
      remove: state.remove,
      cancelAlert: state.cancelAlert,
    }))
  );

  // 강조되는 버튼을 오른쪽(DOM상 두 번째)에 두면서도 Radix가 기본으로 주는 "첫 번째 포커스
  // 가능 요소" 오토포커스가 반대쪽으로 가버리는 걸 막는다 - 강조된 쪽이 여전히 처음
  // 포커스를 받아야 한다(§ docs/DECISIONS.md 2026-09-29 팔로업 항목).
  const emphasizedButtonRef = useRef<HTMLButtonElement>(null);

  const {
    id,
    title,
    message,
    confirmText = TEXTS.buttons.confirm,
    cancelText = TEXTS.buttons.cancel,
    type,
    isOpen,
    emphasis = 'cancel',
  } = alert;

  const handleConfirm = () => {
    // close()를 onConfirm()보다 먼저 호출한다 - onConfirm이 동기적으로 같은 pathname
    // 네비게이션을 트리거하는 경우(예: 폴더 삭제의 onBeforeDelete), 순서가 반대면 그
    // 네비게이션이 "아직 안 닫힌 이 알럿" 때문에 useUnsavedChangesGuard에 막혔다가,
    // 막힌 걸 정리하는 이펙트가 실행되는 시점엔 이미 알럿이 닫혀 있어 "열린 알럿 때문에
    // 막혔다"는 분기를 못 타고 엉뚱한 "저장하지 않은 변경사항" 확인창을 새로 띄워버린다
    // (실측: 폴더 삭제 시 확인 버튼을 눌러도 즉시 반영되지 않고 이 확인창이 한 번 더 떴다).
    close(id);
    alert.onConfirm?.();
    setTimeout(() => remove(id), 300);
  };

  // 취소 버튼 클릭과 오버레이 바깥에서의 취소(뒤로가기 등)가 같은 동작이라 스토어 액션 하나로 합친다.
  const handleCancel = () => cancelAlert(id);
  const handleClose = () => cancelAlert(id);

  // 강조되는 쪽(emphasis)이 채움 + emphasizedButtonRef(초기 포커스)를 갖고, 렌더 순서에서도
  // 항상 오른쪽(뒤)에 온다. 두 버튼을 미리 만들어두고 emphasis에 따라 순서만 바꿔 끼운다.
  const cancelButton = type === 'confirm' && (
    <Button
      key="cancel"
      variant={emphasis === 'confirm' ? 'outline' : 'default'}
      onClick={handleCancel}
      ref={emphasis === 'cancel' ? emphasizedButtonRef : undefined}
      className="flex-1 sm:flex-none sm:min-w-[80px]"
    >
      {cancelText}
    </Button>
  );
  const confirmButton = (
    <Button
      key="confirm"
      variant={type === 'confirm' && emphasis === 'cancel' ? 'outline' : 'default'}
      onClick={handleConfirm}
      ref={emphasis === 'confirm' ? emphasizedButtonRef : undefined}
      className="flex-1 sm:flex-none sm:min-w-[80px]"
    >
      {confirmText}
    </Button>
  );

  // 히스토리에 묶이지 않은 대화상자라 뒤로가기가 라우트만 바꿔도 알아채지 못하고 배경만
  // 바뀐 채로 계속 떠 있는다 - 열려있던 위치를 벗어나면 취소로 간주해 닫는다.
  // pathname이 아니라 key를 본다 - 북마크 페이지처럼 폴더 이동이 쿼리 파라미터로만
  // 표현되는 경우 pathname은 안 바뀌지만 key는 navigate마다 항상 새로 발급된다.
  const location = useLocation();
  const openedKeyRef = useRef(location.key);
  useEffect(() => {
    if (isOpen && location.key !== openedKeyRef.current) {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleClose();
        }
      }}
    >
      <DialogContent
        className="max-w-[calc(100%-2rem)] sm:max-w-[400px]"
        onOpenAutoFocus={(e) => {
          if (type === 'confirm') {
            e.preventDefault();
            emphasizedButtonRef.current?.focus();
          }
        }}
      >
        <DialogHeader className="items-center text-center">
          {title ? (
            <DialogTitle>{title}</DialogTitle>
          ) : (
            <DialogTitle className="sr-only">Alert</DialogTitle>
          )}
          <DialogDescription
            className={cn('text-center text-foreground font-medium', !title && 'pt-4')}
          >
            {typeof message === 'string' ? (
              <span className="whitespace-pre-wrap">{message.replace(/([.?])\s+/g, '$1\n')}</span>
            ) : (
              message
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row justify-center gap-2 sm:justify-center mt-2">
          {/* 강조되는 쪽(기본은 취소)이 채움 + 오른쪽 + 초기 포커스, 반대쪽이 outline + 왼쪽이다.
              채움으로 강조하는 원칙은 Nielsen(2008) "가장 자주 선택되는 버튼을 기본값으로 두고
              강조하라(단, 위험하면 예외)"(번역, https://www.nngroup.com/articles/ok-cancel-or-cancel-ok/)를
              따르고, 오른쪽(trailing)에 두는 배치는 Apple HIG "사람들이 가장 많이 고를 버튼을
              trailing 쪽에 둔다"(번역, https://developer.apple.com/design/human-interface-guidelines/alerts)를
              따른다. 되돌리기 어려운 동작(삭제·이탈 등)은 취소가 안전한 쪽이라 기본값으로
              강조하지만, 언제든 되돌릴 수 있는 토글(공개 설정 등)처럼 어느 쪽도 위험하지 않으면
              호출부가 emphasis: 'confirm'으로 반대로 켤 수 있다 — 이때는 확인이 채움+오른쪽으로
              옮겨간다. 근거: docs/DECISIONS.md 2026-09-29 항목(팔로업 포함) */}
          {emphasis === 'confirm' ? (
            <>
              {cancelButton}
              {confirmButton}
            </>
          ) : (
            <>
              {confirmButton}
              {cancelButton}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * 전역 Alert/Confirm 모달 렌더러
 * App 최상위에 배치하여 사용합니다.
 */
export function GlobalAlerts() {
  const alerts = useAlertStore((state) => state.alerts);

  return (
    <>
      {alerts.map((alert) => (
        <Alert key={alert.id} alert={alert} />
      ))}
    </>
  );
}
