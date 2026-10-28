import { create } from 'zustand';
import { WIDE_MEDIA_QUERY } from '@/shared/config/const';

interface SidebarState {
  isOpen: boolean;
  toggle: () => void;
  open: () => void;
  close: () => void;
}

// 48~64rem(세로 태블릿 등)은 레일(w-20)로 시작해야 목록이 2열을 받는다
// (docs/plans/2026-10-28-tablet-width-rail.md). 그 뒤 폭이 64rem을 넘나들 때는 Sidebar.tsx가 맞춘다.
const isWide = typeof window !== 'undefined' && window.matchMedia(WIDE_MEDIA_QUERY).matches;

export const useSidebarStore = create<SidebarState>()((set) => ({
  isOpen: isWide,
  toggle: () => set((state) => ({ isOpen: !state.isOpen })),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));
