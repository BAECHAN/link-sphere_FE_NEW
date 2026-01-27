import { Moon, Sun, Search, SearchIcon } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/shared/ui/atoms/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/ui/atoms/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/shared/ui/atoms/avatar';
import { useState } from 'react';
import { Input } from '@/shared/ui/atoms/input';
import { Kbd } from '@/shared/ui/atoms/kbd';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { useAuthStore } from '@/domains/auth/_common/model/auth.store';
import { useLogoutMutation } from '@/domains/auth/_common/api/auth.queries';

export function Navbar() {
  const { user, isAuthenticated } = useAuthStore();
  const { mutate: logout } = useLogoutMutation();
  const navigate = useNavigate();

  const [isMobileSearchOpen, setIsMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearch = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const toggleMobileSearch = () => {
    setIsMobileSearchOpen(!isMobileSearchOpen);
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="container max-w-6xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 md:gap-8">
          <Link
            to={ROUTES_PATHS.HOME}
            className="flex items-center space-x-2 font-bold text-xl md:text-2xl tracking-tight"
          >
            LinkSphere
          </Link>
          <div className="hidden md:flex gap-6">
            <Link
              to={ROUTES_PATHS.POST.ROOT}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Post
            </Link>
            <Link
              to={ROUTES_PATHS.POST.SUBMIT}
              className="text-sm font-medium transition-colors hover:text-primary"
            >
              Submit
            </Link>
          </div>
        </div>

        {/* Search Bar - Hidden on mobile, shown on larger screens */}
        <form onSubmit={() => {}} className="hidden md:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <SearchIcon className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input
              id="header-search-input"
              placeholder="키워드나 @카테고리..."
              value={''}
              onChange={() => {}}
              className="pl-8 pr-10 bg-muted/50 border-none transition-all focus:bg-background focus:ring-1 focus:ring-primary/20"
            />
            <Kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 select-none items-center gap-1 rounded border bg-white px-1.5 font-mono text-[10px] font-medium opacity-100 flex size-5">
              <span className="text-xs">/</span>
            </Kbd>
          </div>
        </form>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden h-9 w-9"
            onClick={toggleMobileSearch}
          >
            <Search className="h-5 w-5" />
            <span className="sr-only">Toggle search</span>
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
            <span className="sr-only">Toggle theme</span>
          </Button>

          {isAuthenticated ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full ml-2">
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={''} alt={user?.name || ''} />
                    <AvatarFallback>{user?.name?.[0] || 'U'}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => logout()}>Log out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button onClick={() => navigate(ROUTES_PATHS.AUTH.LOGIN)} size="sm" className="ml-2">
              Log in
            </Button>
          )}
        </div>
      </div>

      {/* Mobile Search Bar Expansion */}
      {isMobileSearchOpen && (
        <div className="md:hidden border-t p-4 bg-background">
          <form onSubmit={handleSearch} className="w-full flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="mobile-search-input"
                autoFocus
                placeholder="키워드나 @카테고리..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 bg-muted/50"
              />
            </div>
            <Button type="submit">검색</Button>
          </form>
        </div>
      )}
    </nav>
  );
}
