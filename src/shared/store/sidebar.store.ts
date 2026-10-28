import { create } from 'zustand';
import { DESKTOP_MEDIA_QUERY } from '@/shared/config/const';

interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const isDesktop = typeof window !== 'undefined' && window.matchMedia(DESKTOP_MEDIA_QUERY).matches;

export const useSidebarStore = create<SidebarState>()((set) => ({
  isOpen: isDesktop,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),
}));
