import { create } from 'zustand';

interface MyPageRestoreValues {
  nickname: string;
  imagePreview: string | null;
  pendingFile: File | null;
}

interface MyPageModalState {
  isOpen: boolean;
  /** 저장 실패 후 "다시 열기"로 재오픈할 때 복원할 입력값 - 정상 open()에서는 null */
  restoreValues: MyPageRestoreValues | null;
  open: () => void;
  openWith: (values: MyPageRestoreValues) => void;
  close: () => void;
}

export const useMyPageModalStore = create<MyPageModalState>()((set) => ({
  isOpen: false,
  restoreValues: null,
  open: () => set({ isOpen: true, restoreValues: null }),
  openWith: (values) => set({ isOpen: true, restoreValues: values }),
  close: () => set({ isOpen: false }),
}));
