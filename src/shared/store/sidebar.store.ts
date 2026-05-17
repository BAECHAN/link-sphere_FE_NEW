import { create } from 'zustand';

interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  close: () => void;
}

const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;

export const useSidebarStore = create<SidebarState>()((set) => ({
  isOpen: isDesktop,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  close: () => set({ isOpen: false }),
}));
