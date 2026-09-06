import { useEffect } from 'react';
import { Menu, X } from 'lucide-react';
import { Button } from '@/shared/ui/atoms/button';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/tailwind/utils';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { NAV_ITEMS, type NavItemConfig } from '@/shared/config/nav-items';
import { useSidebarStore } from '@/shared/store/sidebar.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { useProtectedNavigate } from '@/entities/user/model/useProtectedNavigate';

function NavItem({
  to,
  icon: Icon,
  label,
  isActive,
  requiresAuth,
  expanded,
}: NavItemConfig & { expanded: boolean }) {
  const { pathname } = useLocation();
  const protectedNavigate = useProtectedNavigate();
  const active = isActive(pathname);

  // 모바일 드로어를 별도로 닫지 않는다 - 아래 두 분기 모두 어차피 새 위치로 navigate하고,
  // 그 위치의 location.state엔 sidebarOpen이 없어 드로어는 자연히 사라진다. 여기서
  // navigate(-1)(드로어 close)까지 같이 호출하면 비동기 go(-1)이 뒤늦게 처리되면서
  // 방금 push한(비로그인 시 로그인모달 open 등) 엔트리를 엉뚱하게 삼켜버리는 레이스가 생겼다.
  const handleClick = (e: React.MouseEvent) => {
    if (requiresAuth) {
      e.preventDefault();
      protectedNavigate(to);
    }
  };

  return (
    <Link
      to={to}
      onClick={handleClick}
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
  /** true 면 햄버거 대신 X 아이콘 표시 — 모바일 드로어가 열린 상태용 */
  showCloseIcon?: boolean;
}

function SidebarHeader({ expanded, onToggle, showCloseIcon = false }: SidebarHeaderProps) {
  const Icon = showCloseIcon ? X : Menu;
  return (
    <div
      className={cn('h-16 flex items-center shrink-0', expanded ? 'px-3 gap-3' : 'justify-center')}
    >
      <Button variant="ghost" size="icon" onClick={onToggle}>
        <Icon className="size-6" />
        <span className="sr-only">{TEXTS.nav.toggleMenu}</span>
      </Button>
      {expanded && (
        <Link to={ROUTES_PATHS.POST.ROOT} className="font-bold text-xl tracking-tight truncate">
          {TEXTS.nav.brand}
        </Link>
      )}
    </div>
  );
}

export function Sidebar() {
  const { isOpen, toggle } = useSidebarStore(); // 데스크톱 접힘/펼침 상태
  // 모바일 드로어는 뒤로가기로 닫혀야 하므로 히스토리 엔트리로 관리한다 (데스크톱 접힘 상태와는 별개)
  const { isOpen: isMobileOpen, close } = useHistoryOverlay('sidebarOpen');

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
      {isMobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-55 bg-black/50"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* 모바일: 드로어 패널 */}
      <aside
        className={cn(
          'md:hidden fixed top-0 left-0 z-60 h-full w-64 bg-background border-r flex flex-col',
          'transition-transform duration-200',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <SidebarHeader expanded onToggle={close} showCloseIcon />
        <nav className="flex flex-col gap-1 py-4 px-2">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} expanded />
          ))}
        </nav>
      </aside>
    </>
  );
}
