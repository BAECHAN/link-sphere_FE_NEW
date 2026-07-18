import { create } from 'zustand';

interface LoginModalState {
  isOpen: boolean;
  /** 로그인 성공 시 실행할 콜백 (예: 원래 가려던 페이지로 이동) */
  onSuccess?: () => void;
  open: (onSuccess?: () => void) => void;
  close: () => void;
}

export const useLoginModalStore = create<LoginModalState>()((set) => ({
  isOpen: false,
  onSuccess: undefined,
  open: (onSuccess) => set({ isOpen: true, onSuccess }),
  close: () => set({ isOpen: false, onSuccess: undefined }),
}));
