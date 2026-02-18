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

interface AlertProps {
  alert: AlertData;
}

function Alert({ alert }: AlertProps) {
  const { close, remove } = useAlertStore(
    useShallow((state) => ({ close: state.close, remove: state.remove }))
  );

  const { id, title, message, confirmText = '확인', cancelText = '취소', type, isOpen } = alert;

  const handleConfirm = () => {
    alert.onConfirm?.();
    close(id);
    setTimeout(() => remove(id), 300);
  };

  const handleCancel = () => {
    alert.onCancel?.();
    close(id);
    setTimeout(() => remove(id), 300);
  };

  const handleClose = () => {
    if (type === 'confirm') {
      alert.onCancel?.();
    }
    close(id);
    setTimeout(() => remove(id), 300);
  };

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
