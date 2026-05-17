import { useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Home, Link2, Menu } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/tailwind/utils';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useSidebarStore } from '@/shared/store/sidebar.store';

interface NavItemConfig {
  to: string;
  icon: LucideIcon;
  label: string;
  isActive: (pathname: string) => boolean;
}

const NAV_ITEMS: NavItemConfig[] = [
  {
    to: ROUTES_PATHS.POST.ROOT,
    icon: Home,
    label: TEXTS.nav.feed,
    isActive: (pathname) =>
      pathname.startsWith('/post') &&
      !pathname.startsWith('/post/submit') &&
      !pathname.startsWith('/post/edit'),
  },
  {
    to: ROUTES_PATHS.POST.SUBMIT,
    icon: Link2,
    label: TEXTS.nav.submit,
    isActive: (pathname) =>
      pathname.startsWith('/post/submit') || pathname.startsWith('/post/edit'),
  },
];

function NavItem({
  to,
  icon: Icon,
  label,
  isActive,
  expanded,
  onClick,
}: NavItemConfig & { expanded: boolean; onClick?: () => void }) {
  const { pathname } = useLocation();
  const active = isActive(pathname);

  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn(
        'flex items-center rounded-xl w-full hover:bg-accent',
        expanded ? 'flex-row gap-3 px-4 py-3' : 'flex-col gap-1 justify-center py-3 px-2',
        active && 'bg-accent'
      )}
    >
      <Icon className={cn('h-5 w-5 shrink-0', active ? 'text-primary' : 'text-muted-foreground')} />
      <span
        className={cn(
          'font-medium',
          expanded ? 'text-sm' : 'text-xs text-center leading-tight',
          active ? 'text-primary' : 'text-muted-foreground'
        )}
      >
        {label}
      </span>
    </Link>
  );
}

interface SidebarHeaderProps {
  expanded: boolean;
  onToggle: () => void;
  onLogoClick?: () => void;
}

function SidebarHeader({ expanded, onToggle, onLogoClick }: SidebarHeaderProps) {
  return (
    <div
      className={cn('h-16 flex items-center shrink-0', expanded ? 'px-3 gap-3' : 'justify-center')}
    >
      <Button variant="ghost" size="icon" onClick={onToggle}>
        <Menu className="size-6" />
        <span className="sr-only">{TEXTS.nav.toggleMenu}</span>
      </Button>
      {expanded && (
        <Link
          to={ROUTES_PATHS.HOME}
          onClick={onLogoClick}
          className="font-bold text-xl tracking-tight truncate"
        >
          {TEXTS.nav.brand}
        </Link>
      )}
    </div>
  );
}

export function Sidebar() {
  const { isOpen, toggle, close } = useSidebarStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggle]);

  return (
    <>
      {/* 데스크탑: 좌측 사이드바 */}
      <aside
        className={cn(
          'hidden md:flex flex-col border-r bg-background shrink-0 sticky top-0 h-screen overflow-hidden',
          isOpen ? 'w-60' : 'w-20'
        )}
      >
        <SidebarHeader expanded={isOpen} onToggle={toggle} />
        <nav className="flex flex-col items-stretch gap-1 py-4 px-1">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} expanded={isOpen} />
          ))}
        </nav>
      </aside>

      {/* 모바일: 드로어 백드롭 */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/50"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* 모바일: 드로어 패널 */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 z-[60] h-full w-64 bg-background border-r flex flex-col',
          'transition-transform duration-200',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarHeader expanded onToggle={close} onLogoClick={close} />
        <nav className="flex flex-col gap-1 py-4 px-2">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} expanded onClick={close} />
          ))}
        </nav>
      </aside>
    </>
  );
}
