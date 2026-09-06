import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const HIDE_BOTS_KEY = STORAGE_KEYS.PREFERENCES.HIDE_BOTS;

const getInitialHideBots = (): boolean => LocalStorageUtil.getItem<boolean>(HIDE_BOTS_KEY) === true;

interface HideBotsState {
  hideBots: boolean;
  setHideBots: (hideBots: boolean) => void;
}

/** "봇 글 숨기기" 설정. 기기별 개인 설정이라 URL이 아닌 localStorage에 영속화한다 */
export const useHideBotsStore = create<HideBotsState>()(
  devtools(
    (set) => ({
      hideBots: getInitialHideBots(),
      setHideBots: (hideBots) => {
        LocalStorageUtil.setItem(HIDE_BOTS_KEY, hideBots);
        set({ hideBots });
      },
    }),
    { name: 'hide-bots-store' }
  )
);
