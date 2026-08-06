import { create } from 'zustand';

interface LoginModalState {
  /** 로그인 성공 시 실행할 콜백 (예: 원래 가려던 페이지로 이동) */
  onSuccess?: () => void;
  setOnSuccess: (onSuccess?: () => void) => void;
}

export const useLoginModalStore = create<LoginModalState>()((set) => ({
  onSuccess: undefined,
  setOnSuccess: (onSuccess) => set({ onSuccess }),
}));
