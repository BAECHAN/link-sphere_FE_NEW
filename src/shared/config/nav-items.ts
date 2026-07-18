import type { LucideIcon } from 'lucide-react';
import { Bookmark, Home, Link2 } from 'lucide-react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

export interface NavItemConfig {
  to: string;
  icon: LucideIcon;
  label: string;
  isActive: (pathname: string) => boolean;
  /** 인증이 필요한 항목 — 비로그인 클릭 시 이동 대신 로그인 모달을 띄운다 */
  requiresAuth?: boolean;
}

// '/post/edit/:id' → '/post/edit' (prefix 매칭용, usePostCard의 EDIT.replace 컨벤션과 동일)
const POST_EDIT_PATH = ROUTES_PATHS.POST.EDIT.replace('/:id', '');

export const NAV_ITEMS: NavItemConfig[] = [
  {
    to: ROUTES_PATHS.POST.ROOT,
    icon: Home,
    label: TEXTS.nav.feed,
    isActive: (pathname) =>
      pathname.startsWith(ROUTES_PATHS.POST.ROOT) &&
      !pathname.startsWith(ROUTES_PATHS.POST.SUBMIT) &&
      !pathname.startsWith(POST_EDIT_PATH),
  },
  {
    to: ROUTES_PATHS.POST.SUBMIT,
    icon: Link2,
    label: TEXTS.nav.submit,
    isActive: (pathname) =>
      pathname.startsWith(ROUTES_PATHS.POST.SUBMIT) || pathname.startsWith(POST_EDIT_PATH),
    requiresAuth: true,
  },
  {
    to: ROUTES_PATHS.BOOKMARK,
    icon: Bookmark,
    label: TEXTS.nav.bookmark,
    isActive: (pathname) => pathname.startsWith(ROUTES_PATHS.BOOKMARK),
    requiresAuth: true,
  },
];
