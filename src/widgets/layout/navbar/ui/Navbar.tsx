import { Moon, Sun, Search, Menu } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/shared/ui/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/atoms/avatar';
import { Spinner } from '@/shared/ui/atoms/spinner';
import { useEffect, useState } from 'react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useAuthStore } from '@/shared/store/auth.store';
import { useAuth } from '@/entities/user/hooks/useAuth';
import { useAccount } from '@/entities/user/hooks/useAccount';
import { NavbarSearch } from '@/widgets/layout/navbar/ui/NavbarSearch';
import { MobileNavbarSearch } from '@/widgets/layout/navbar/ui/MobileNavbarSearch';
import { PostCreationLoadingBadge } from '@/shared/ui/elements/PostCreationLoadingBadge';
import { MyPageModal } from '@/widgets/layout/mypage/ui/MyPageModal';
import { TEXTS } from '@/shared/config/texts';
import { useToggle } from '@/shared/hooks/useToggle';
import { useSidebarStore } from '@/shared/store/sidebar.store';
import { useLoginModalStore } from '@/shared/store/loginModal.store';

export function Navbar() {
  const { isAuthenticated } = useAuthStore();
  const { logout } = useAuth();

  const { account } = useAccount();

  const {
    value: isMobileSearchOpen,
    toggle: toggleMobileSearch,
    close: closeMobileSearch,
  } = useToggle(false);
  const [isMyPageOpen, setIsMyPageOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { toggle: toggleSidebar } = useSidebarStore();
  const openLoginModal = useLoginModalStore((state) => state.open);

  // 로그아웃이 처리되고 있음을 잠깐 보여준 뒤 실제 로그아웃 (즉시 로그인 버튼으로 바뀌어
  // 정말 로그아웃됐는지 사용자가 의심하는 것을 방지)
  const handleLogout = async () => {
    setIsLoggingOut(true);
    await new Promise((resolve) => setTimeout(resolve, 700));
    logout();
    setIsLoggingOut(false);
  };

  const { pathname } = useLocation();

  useEffect(
    function closeSearchOnRouteChange() {
      closeMobileSearch();
    },
    [pathname, closeMobileSearch]
  );

  return (
    <>
      <nav className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
        <div className="flex h-16 items-center justify-between px-4">
          {/* Mobile only: hamburger + logo */}
          <div className="flex md:hidden items-center gap-2">
            <Button variant="ghost" size="icon" onClick={toggleSidebar}>
              <Menu className="size-6" />
              <span className="sr-only">{TEXTS.nav.toggleMenu}</span>
            </Button>
            <Link to={ROUTES_PATHS.HOME} className="font-bold text-xl tracking-tight">
              {TEXTS.nav.brand}
            </Link>
          </div>

          {/* Desktop: search bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <NavbarSearch />
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <PostCreationLoadingBadge />
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden h-9 w-9"
              onClick={toggleMobileSearch}
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
                    <Avatar className="h-8 w-8 border">
                      <AvatarImage src={account?.image ?? ''} alt={account?.nickname ?? ''} />
                      {!account?.image && (
                        <AvatarFallback>
                          {account?.nickname?.[0]?.toUpperCase() ?? 'U'}
                        </AvatarFallback>
                      )}
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setIsMyPageOpen(true)}>
                    {TEXTS.buttons.profileEdit}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>{TEXTS.nav.logOut}</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button onClick={() => openLoginModal()} size="sm" className="ml-2">
                {TEXTS.nav.logIn}
              </Button>
            )}
          </div>
        </div>

        {/* Mobile Search Bar Expansion */}
        {isMobileSearchOpen && (
          <div className="md:hidden border-t p-4 bg-background">
            <MobileNavbarSearch />
          </div>
        )}
      </nav>

      {/* Mobile Search Backdrop */}
      {isMobileSearchOpen && (
        <div
          className="md:hidden fixed inset-0 top-16 z-40 bg-black/40"
          onClick={toggleMobileSearch}
        />
      )}

      <MyPageModal open={isMyPageOpen} onOpenChange={setIsMyPageOpen} />
    </>
  );
}
