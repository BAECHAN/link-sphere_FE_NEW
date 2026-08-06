import { create } from 'zustand';
import { ReactNode } from 'react';
import { devtools } from 'zustand/middleware';

export interface AlertData {
  id: string;
  title?: ReactNode;
  message: ReactNode | string;
  confirmText?: string;
  cancelText?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  type: 'alert' | 'confirm';
  isOpen: boolean;
}

type OpenAlertOptions = Pick<AlertData, 'title' | 'message' | 'confirmText' | 'onConfirm'>;
type OpenConfirmOptions = Pick<
  AlertData,
  'title' | 'message' | 'confirmText' | 'cancelText' | 'onConfirm' | 'onCancel'
>;

interface AlertStore {
  alerts: AlertData[];
  openAlert: (data: OpenAlertOptions) => void;
  openConfirm: (data: OpenConfirmOptions) => void;
  close: (id: string) => void;
  remove: (id: string) => void;
  cancelAlert: (id: string) => void;
}

export const useAlertStore = create<AlertStore>()(
  devtools(
    (set, get) => ({
      alerts: [],
      openAlert: (data) =>
        set((state) => ({
          alerts: [
            ...state.alerts,
            { ...data, id: Math.random().toString(36).slice(2), type: 'alert', isOpen: true },
          ],
        })),
      openConfirm: (data) =>
        set((state) => ({
          alerts: [
            ...state.alerts,
            { ...data, id: Math.random().toString(36).slice(2), type: 'confirm', isOpen: true },
          ],
        })),
      close: (id) =>
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === id ? { ...alert, isOpen: false } : alert
          ),
        })),
      remove: (id) =>
        set((state) => ({
          alerts: state.alerts.filter((alert) => alert.id !== id),
        })),
      // Alert.tsx의 취소 버튼과 동일한 동작을 컴포넌트 바깥(라우터 blocker)에서도 실행할 수 있게 노출한다.
      cancelAlert: (id) => {
        const alert = get().alerts.find((a) => a.id === id);
        if (alert?.type === 'confirm') {
          alert.onCancel?.();
        }
        get().close(id);
        setTimeout(() => get().remove(id), 300);
      },
    }),
    { name: 'alert-store' }
  )
);

/**
 * 현재 열려있는 Alert/Confirm의 id를 즉시 읽는다. 리액트 렌더를 구독하지 않는 시점
 * (라우터 blocker 판정 등)에서만 사용한다.
 */
export function getOpenAlertId(): string | null {
  return useAlertStore.getState().alerts.find((alert) => alert.isOpen)?.id ?? null;
}

/**
 * Alert/Confirm을 호출하기 위한 Hook
 */
export function useAlert() {
  const { openAlert, openConfirm } = useAlertStore();

  return {
    openAlert: (options: OpenAlertOptions) => openAlert(options),
    openConfirm: (options: OpenConfirmOptions) => openConfirm(options),
  };
}
