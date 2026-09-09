import { create } from 'zustand';

interface AppVersionState {
  /**
   * 새 배포를 감지한 시점의 pathname. null이면 아직 감지되지 않은 상태다.
   * 여기서 벗어나는 첫 라우트 이동에 리로드를 건다 - 감지 당시 보고 있던 화면은
   * 사용자가 아무 행동도 안 했는데 갑자기 새로고침되면 안 된다.
   */
  detectedAtPathname: string | null;
  markNewVersionDetected: (pathname: string) => void;
}

/**
 * "서버에 새 배포가 올라왔다"는 사실만 들고 있는 플래그.
 * 감지(useAppVersionCheck)와 적용(useNewVersionReload)을 서로 모르게 잇는다.
 *
 * persist를 붙이지 않는다 - 리로드하면 플래그가 사라져야 같은 판단이 반복되지 않는다.
 */
export const useAppVersionStore = create<AppVersionState>()((set) => ({
  detectedAtPathname: null,
  markNewVersionDetected: (pathname) => set({ detectedAtPathname: pathname }),
}));
