import { Moon, Sun, Search, Menu } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { useLayoutEffect, useRef } from 'react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useAuthStore } from '@/shared/store/auth.store';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';
import { NavbarSearch } from '@/widgets/layout/navbar/ui/NavbarSearch';
import { MobileNavbarSearch } from '@/widgets/layout/navbar/ui/MobileNavbarSearch';
import { RecentSearchPanel } from '@/widgets/layout/navbar/ui/RecentSearchPanel';
import { useRecentSearches } from '@/widgets/layout/navbar/hooks/useRecentSearches';
import { useDelayedLogout } from '@/widgets/layout/navbar/hooks/useDelayedLogout';
import { useMobileSearchPanel } from '@/widgets/layout/navbar/hooks/useMobileSearchPanel';
import { TEXTS } from '@/shared/config/texts';
import { useLoginDialogStore } from '@/shared/store/loginDialog.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { useClickGuard } from '@/shared/hooks/useClickGuard';
import { cn } from '@/shared/lib/tailwind/utils';

export function Navbar() {
  const { isAuthenticated } = useAuthStore();
  const { resolvedTheme, setTheme } = useTheme();
  const canToggleTheme = useClickGuard();

  const { account } = useAccount();

  const { isLoggingOut, handleLogout } = useDelayedLogout();
  const { open: openSidebar } = useHistoryOverlay('sidebarOpen');
  const setLoginOnSuccess = useLoginDialogStore((state) => state.setOnSuccess);
  const { open: openLoginDialog } = useHistoryOverlay('loginDialogOpen');

  const navigate = useNavigate();

  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } =
    useRecentSearches();

  const { isMobileSearchOpen, openMobileSearch, closeMobileSearch, handleSearchSubmit } =
    useMobileSearchPanel(addRecentSearch);

  const navRef = useRef<HTMLElement>(null);

  // Navbar 실제 렌더 높이를 --navbar-height로 게시한다. Navbar CSS가 바뀌어도(반응형
  // 높이 변경 포함) 이 값을 참조하는 쪽(댓글 작성 폼 스크롤 오프셋 등)이 자동으로 따라간다.
  useLayoutEffect(function publishNavbarHeight() {
    const node = navRef.current;

    if (!node) {
      return;
    }

    function updateNavbarHeight() {
      document.documentElement.style.setProperty('--navbar-height', `${node!.offsetHeight}px`);
    }

    updateNavbarHeight();

    const observer = new ResizeObserver(updateNavbarHeight);
    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  return (
    <>
      <nav
        ref={navRef}
        className="sticky top-0 z-nav w-full bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60"
      >
        <div className="flex h-16 items-center justify-between px-4">
          {/* Mobile 검색 모드: 뒤로가기 + 입력창 + 지우기가 상단 바 전체를 대체 */}
          {isMobileSearchOpen ? (
            <div className="flex-1 md:hidden">
              <MobileNavbarSearch onClose={closeMobileSearch} onSubmit={handleSearchSubmit} />
            </div>
          ) : (
            <div className="flex md:hidden items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                className="relative -left-1.5"
                onClick={openSidebar}
              >
                <Menu className="size-6" />
                <span className="sr-only">{TEXTS.nav.toggleMenu}</span>
              </Button>
              {/* eslint-disable-next-line custom-tailwind/no-raw-title -- 브랜드 워드마크, 제목 역할 토큰 대상 아님 */}
              <Link to={ROUTES_PATHS.POST.ROOT} className="font-bold text-xl tracking-tight">
                {TEXTS.nav.brand}
              </Link>
            </div>
          )}

          {/* Desktop: search bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <NavbarSearch
              recentSearches={recentSearches}
              onAddRecentSearch={addRecentSearch}
              onRemoveRecentSearch={removeRecentSearch}
              onClearRecentSearches={clearRecentSearches}
            />
          </div>

          <div
            className={cn(
              'items-center gap-2 ml-auto',
              isMobileSearchOpen ? 'hidden md:flex' : 'flex'
            )}
          >
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={openMobileSearch}
            >
              <Search className="h-5 w-5" />
              <span className="sr-only">{TEXTS.nav.toggleSearch}</span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => {
                if (!canToggleTheme()) {
                  return;
                }

                setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
              }}
            >
              <Sun className="h-4 w-4 md:h-5 md:w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-4 w-4 md:h-5 md:w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">{TEXTS.nav.toggleTheme}</span>
            </Button>

            {isLoggingOut ? (
              <Button variant="ghost" size="sm" disabled className="ml-2 gap-2">
                <Spinner className="h-4 w-4 animate-spin" />
                {TEXTS.nav.loggingOut}
              </Button>
            ) : isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    className="relative h-8 w-8 rounded-full ml-2"
                    aria-label={
                      account?.emailVerified === false
                        ? TEXTS.ariaLabels.accountMenuUnverified
                        : TEXTS.ariaLabels.accountMenu
                    }
                  >
                    <UserAvatar
                      image={account?.image}
                      nickname={account?.nickname}
                      size="md"
                      className="border"
                    />
                    {account?.emailVerified === false && (
                      <span
                        aria-hidden="true"
                        className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-destructive ring-2 ring-background"
                      />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => navigate(ROUTES_PATHS.MY_COMMENTS)}>
                    {TEXTS.buttons.myComments}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate(ROUTES_PATHS.MY_ACCOUNT)}>
                    {TEXTS.buttons.accountSettings}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>{TEXTS.nav.logOut}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => {
                  setLoginOnSuccess(undefined);
                  openLoginDialog();
                }}
                size="sm"
                className="ml-2"
              >
                {TEXTS.nav.logIn}
              </Button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile 검색 모드: 최근 검색 목록이 피드를 대신 덮는다 (탭바는 위에 그대로 눌림) */}
      {isMobileSearchOpen && (
        <RecentSearchPanel
          recentSearches={recentSearches}
          onSelect={handleSearchSubmit}
          onRemove={removeRecentSearch}
          onClearAll={clearRecentSearches}
        />
      )}
    </>
  );
}
