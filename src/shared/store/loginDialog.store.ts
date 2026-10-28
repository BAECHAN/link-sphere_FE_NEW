import { create } from 'zustand';
import type { SignedOutInPlaceReason } from '@/shared/store/auth.store';

/**
 * 로그인 창의 열림은 history state의 loginDialogOpen이 정한다(useHistoryOverlay). 로그인이 풀려 쓰던 화면에서 연
 * 창은 loginDialogReason도 함께 실어, 창이 왜 떴는지를 제목·설명으로 알린다(useLoginDialog).
 */
export interface LoginDialogLocationState {
  loginDialogOpen?: boolean;
  loginDialogReason?: SignedOutInPlaceReason;
}

/** 로그인이 풀린 화면에서 여는 로그인 창의 history state(AuthUtil). 열 때마다 새 객체를 만들지 않게 모듈 상수로 둔다 */
export const SIGNED_OUT_IN_PLACE_DIALOG_STATE: Record<
  SignedOutInPlaceReason,
  LoginDialogLocationState
> = {
  expired: { loginDialogOpen: true, loginDialogReason: 'expired' },
  signedOutElsewhere: { loginDialogOpen: true, loginDialogReason: 'signedOutElsewhere' },
};

interface LoginDialogState {
  /**
   * 로그인 성공 시 실행할 콜백 (예: 원래 가려던 페이지로 이동).
   * 계약: 콜백 스스로 navigate해 이 모달의 히스토리 엔트리를 벗어나야 한다 -
   * LoginDialog는 이 콜백을 실행한 뒤 close()를 부르지 않는다(navigate가 이미
   * 엔트리를 벗어났다고 가정하기 때문). navigate하지 않는 콜백은 대신
   * pendingAction을 쓴다.
   */
  onSuccess?: () => void;
  setOnSuccess: (onSuccess?: () => void) => void;
  /**
   * 로그인 성공 후 모달이 닫힌 뒤에 실행할 재개 액션 (예: 폴더 선택 모달 열기).
   * onSuccess와 반대로 navigate하지 않는 콜백 전용이다 - LoginDialog가 먼저
   * close()로 직접 닫고, 그 닫힘이 반영된 뒤에 실행해 두 모달이 겹치지 않게 한다.
   */
  pendingAction?: () => void;
  setPendingAction: (pendingAction?: () => void) => void;
}

export const useLoginDialogStore = create<LoginDialogState>()((set) => ({
  onSuccess: undefined,
  setOnSuccess: (onSuccess) => set({ onSuccess }),
  pendingAction: undefined,
  setPendingAction: (pendingAction) => set({ pendingAction }),
}));
