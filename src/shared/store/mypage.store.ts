import { create } from 'zustand';

interface MyPageRestoreValues {
  nickname: string;
  imagePreview: string | null;
  pendingFile: File | null;
}

interface MyPageModalState {
  /** 저장 실패 후 "다시 열기"로 재오픈할 때 복원할 입력값 - 정상 open에서는 null */
  restoreValues: MyPageRestoreValues | null;
  setRestoreValues: (values: MyPageRestoreValues | null) => void;
}

export const useMyPageModalStore = create<MyPageModalState>()((set) => ({
  restoreValues: null,
  setRestoreValues: (values) => set({ restoreValues: values }),
}));
