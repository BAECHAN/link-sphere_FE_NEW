import { Moon, Sun, Search, Menu } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { useState } from 'react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useAuthStore } from '@/shared/store/auth.store';
import { useAuth } from '@/entities/user/hooks/useAuth';
import { useAccount } from '@/entities/user/hooks/useAccount';
import { UserAvatar } from '@/entities/user/ui/UserAvatar';
import { NavbarSearch } from '@/widgets/layout/navbar/ui/NavbarSearch';
import { MobileNavbarSearch } from '@/widgets/layout/navbar/ui/MobileNavbarSearch';
import { RecentSearchPanel } from '@/widgets/layout/navbar/ui/RecentSearchPanel';
import { useRecentSearches } from '@/widgets/layout/navbar/hooks/useRecentSearches';
import { PostMutationLoadingBadge } from '@/shared/ui/elements/PostMutationLoadingBadge';
import { MyPageModal } from '@/widgets/layout/mypage/ui/MyPageModal';
import { TEXTS } from '@/shared/config/texts';
import { useLoginModalStore } from '@/shared/store/loginModal.store';
import { useMyPageModalStore } from '@/shared/store/mypage.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { cn } from '@/shared/lib/tailwind/utils';

interface NavbarLocationState {
  mobileSearchOpen?: boolean;
}

export function Navbar() {
  const { isAuthenticated } = useAuthStore();
  const { logout } = useAuth();

  const { account } = useAccount();

  const setMyPageRestoreValues = useMyPageModalStore((state) => state.setRestoreValues);
  const {
    isOpen: isMyPageOpen,
    open: openMyPage,
    close: closeMyPage,
  } = useHistoryOverlay('myPageOpen');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { open: openSidebar } = useHistoryOverlay('sidebarOpen');
  const setLoginOnSuccess = useLoginModalStore((state) => state.setOnSuccess);
  const { open: openLoginModal } = useHistoryOverlay('loginModalOpen');

  // 로그아웃이 처리되고 있음을 잠깐 보여준 뒤 실제 로그아웃 (즉시 로그인 버튼으로 바뀌어
  // 정말 로그아웃됐는지 사용자가 의심하는 것을 방지)
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    logout();
    setIsLoggingOut(false);
  };

  const location = useLocation();
  const navigate = useNavigate();

  // 모바일 검색 패널 상태를 히스토리 엔트리에 실어 보낸다.
  // 열 때 새 엔트리를 push하므로 뒤로가기(하드웨어 버튼·엣지 스와이프)를 누르면
  // 페이지 이동이 아니라 이 엔트리가 pop되며 패널만 자연스럽게 닫힌다.
  const isMobileSearchOpen = Boolean(
    (location.state as NavbarLocationState | null)?.mobileSearchOpen
  );

  const openMobileSearch = () => {
    navigate(`${location.pathname}${location.search}`, { state: { mobileSearchOpen: true } });
  };

  const closeMobileSearch = () => {
    if (isMobileSearchOpen) {
      navigate(-1);
    }
  };

  const { recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } =
    useRecentSearches();

  const handleSearchSubmit = (query: string) => {
    const trimmed = query.trim();
    if (trimmed) {
      addRecentSearch(trimmed);
    }
    const params = trimmed ? `?q=${encodeURIComponent(trimmed)}` : '';
    // replace: 검색열림 엔트리를 결과 화면으로 대체 → 결과에서 뒤로가기 시 검색 패널이 다시 열리지 않음
    navigate(`${ROUTES_PATHS.POST.ROOT}${params}`, { replace: true });
  };

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4">
          {/* Mobile 검색 모드: 뒤로가기 + 입력창 + 지우기가 상단 바 전체를 대체 */}
          {isMobileSearchOpen ? (
            <div className="flex-1 md:hidden">
              <MobileNavbarSearch onClose={closeMobileSearch} onSubmit={handleSearchSubmit} />
            </div>
          ) : (
            <div className="flex md:hidden items-center gap-2">
              <Button variant="ghost" size="icon" onClick={openSidebar}>
                <Menu className="size-6" />
                <span className="sr-only">{TEXTS.nav.toggleMenu}</span>
              </Button>
              <Link to={ROUTES_PATHS.POST.ROOT} className="font-bold text-xl tracking-tight">
                {TEXTS.nav.brand}
              </Link>
            </div>
          )}

          {/* Desktop: search bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <NavbarSearch />
          </div>

          <div
            className={cn(
              'items-center gap-2 ml-auto',
              isMobileSearchOpen ? 'hidden md:flex' : 'flex'
            )}
          >
            <PostMutationLoadingBadge />
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
                const html = document.documentElement;
                html.classList.toggle('dark');
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
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-2">
                    <UserAvatar
                      image={account?.image}
                      nickname={account?.nickname}
                      size="md"
                      className="border"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={() => {
                      setMyPageRestoreValues(null);
                      openMyPage();
                    }}
                  >
                    {TEXTS.buttons.profileEdit}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>{TEXTS.nav.logOut}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                onClick={() => {
                  setLoginOnSuccess(undefined);
                  openLoginModal();
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

      <MyPageModal
        open={isMyPageOpen}
        onOpenChange={(open) => (open ? openMyPage() : closeMyPage())}
      />
    </>
  );
}
