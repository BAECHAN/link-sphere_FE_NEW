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
}

export const useAlertStore = create<AlertStore>()(
  devtools(
    (set) => ({
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
    }),
    { name: 'alert-store' }
  )
);

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
