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

  const {
    id,
    title,
    message,
    confirmText = TEXTS.buttons.confirm,
    cancelText = TEXTS.buttons.cancel,
    type,
    isOpen,
  } = alert;

  const handleConfirm = () => {
    alert.onConfirm?.();
    close(id);
    setTimeout(() => remove(id), 300);
  };

  // 취소 버튼 클릭과 오버레이 바깥에서의 취소(뒤로가기 등)가 같은 동작이라 스토어 액션 하나로 합친다.
  const handleCancel = () => cancelAlert(id);
  const handleClose = () => cancelAlert(id);

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
      <DialogContent className="max-w-[calc(100%-2rem)] sm:max-w-[400px]">
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
          {type === 'confirm' && (
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 sm:flex-none sm:min-w-[80px]"
            >
              {cancelText}
            </Button>
          )}
          <Button onClick={handleConfirm} className="flex-1 sm:flex-none sm:min-w-[80px]">
            {confirmText}
          </Button>
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
