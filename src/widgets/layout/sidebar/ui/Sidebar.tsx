import { useEffect, useRef, type Ref } from 'react';
import { Menu, X } from 'lucide-react';
import { RemoveScroll } from 'react-remove-scroll';
import { Slot } from '@radix-ui/react-slot';
import { Button } from '@/shared/ui/atoms/button';
import { ToggleButton } from '@/shared/ui/elements/ToggleButton';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/tailwind/utils';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { WIDE_MEDIA_QUERY } from '@/shared/config/const';
import { TEXTS } from '@/shared/config/texts';
import { NAV_ITEMS, type NavItemConfig } from '@/shared/config/nav-items';
import { useSidebarStore } from '@/shared/store/sidebar.store';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';
import { useProtectedNavigate } from '@/entities/auth/hooks/useProtectedNavigate';

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
        'flex items-center rounded-xl w-full select-none hover:bg-accent',
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

// 이름이 곧 동작이다 - 드로어의 X는 항상 닫고, 데스크톱 햄버거는 지금 상태의 반대로 만든다(docs/FE-ARCHITECTURE.md §10-A)
function getToggleLabel(showCloseIcon: boolean, expanded: boolean) {
  if (showCloseIcon) {
    return TEXTS.ariaLabels.close;
  }

  return expanded ? TEXTS.nav.collapseMenu : TEXTS.nav.expandMenu;
}

interface SidebarHeaderProps {
  expanded: boolean;
  onToggle: () => void;
  /** true 면 햄버거 대신 X 아이콘 표시 — 모바일 드로어가 열린 상태용 */
  showCloseIcon?: boolean;
  /** 모바일 드로어가 열릴 때 포커스를 받을 X 버튼 */
  toggleRef?: Ref<HTMLButtonElement>;
}

function SidebarHeader({
  expanded,
  onToggle,
  showCloseIcon = false,
  toggleRef,
}: SidebarHeaderProps) {
  const Icon = showCloseIcon ? X : Menu;
  // 데스크톱 햄버거는 펼침/접힘을 뒤집으므로 더블클릭 가드가 있는 ToggleButton을 쓴다.
  // 모바일 드로어의 X는 항상 "닫기"라 토글이 아니므로 일반 Button으로 둔다.
  const ToggleOrCloseButton = showCloseIcon ? Button : ToggleButton;
  return (
    <div
      className={cn('h-16 flex items-center shrink-0', expanded ? 'px-3 gap-3' : 'justify-center')}
    >
      <ToggleOrCloseButton
        ref={toggleRef}
        variant="ghost"
        size="icon"
        // Button의 transition-all은 드로어에서 물려받는 visibility까지 트랜지션한다. 그러면 드로어가 열린
        // 직후 X는 아직 hidden이라 focus()가 실패하므로 X만 실제로 바뀌는 속성으로 좁힌다
        className={
          showCloseIcon ? 'transition-[color,background-color,border-color,box-shadow]' : undefined
        }
        onClick={onToggle}
      >
        <Icon className="size-6" />
        <span className="sr-only">{getToggleLabel(showCloseIcon, expanded)}</span>
      </ToggleOrCloseButton>
      {expanded && (
        // eslint-disable-next-line custom-tailwind/no-raw-title -- 브랜드 워드마크, 제목 역할 토큰 대상 아님
        <Link to={ROUTES_PATHS.POST.ROOT} className="font-bold text-xl tracking-tight truncate">
          {TEXTS.nav.brand}
        </Link>
      )}
    </div>
  );
}

export function Sidebar() {
  const { isOpen, toggle, open, close: collapse } = useSidebarStore(); // 데스크톱 접힘/펼침 상태
  // 모바일 드로어는 뒤로가기로 닫혀야 하므로 히스토리 엔트리로 관리한다 (데스크톱 접힘 상태와는 별개)
  const { isOpen: isMobileOpen, close } = useHistoryOverlay('sidebarOpen');
  // 백드롭에 건 배경 스크롤 잠금(RemoveScroll)이 드로어 패널 안쪽 스크롤은 허용하도록
  // shards로 지정한다 - dialog.tsx의 DialogOverlayImpl이 shards: [context.contentRef]를
  // 쓰는 것과 같은 이유("Content가 Overlay 안에 안 살아도 스크롤 가능해야 한다").
  const drawerRef = useRef<HTMLElement>(null);
  const drawerCloseRef = useRef<HTMLButtonElement>(null);

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

  // 태블릿을 돌리는 등 폭이 64rem을 넘나들면 그 폭의 기본값(넓으면 펼침, 좁으면 레일)으로 맞춘다.
  // 가로로 연 뒤 세로로 돌렸을 때 펼친 채 남아 목록이 1열로 줄어드는 것을 막는다. ⌘B로 바꾼
  // 상태는 경계를 넘기 전까지만 유지된다(docs/plans/2026-10-28-tablet-width-rail.md)
  useEffect(() => {
    const wide = window.matchMedia(WIDE_MEDIA_QUERY);

    function syncOpen(e: MediaQueryListEvent) {
      if (e.matches) {
        open();
      } else {
        collapse();
      }
    }

    wide.addEventListener('change', syncOpen);

    return () => wide.removeEventListener('change', syncOpen);
  }, [open, collapse]);

  // 열린 메뉴로 포커스를 옮기고 닫으면 연 버튼으로 돌려준다 - 안 옮기면 키보드와 읽기 위치가 메뉴 뒤쪽
  // 햄버거에 머문다. 배경 스크롤 위치를 지키려고 preventScroll을 쓴다(docs/plans/2026-11-06-a11y-button-names.md).
  // 정리 함수는 닫힐 때와 언마운트 때 돈다(https://react.dev/reference/react/useEffect)
  useEffect(() => {
    if (!isMobileOpen) {
      return;
    }

    const drawer = drawerRef.current;
    const opener = document.activeElement;

    drawerCloseRef.current?.focus({ preventScroll: true });

    return () => {
      const focused = document.activeElement;
      // 메뉴 링크로 이동한 새 화면이 이미 포커스를 가져갔으면 뺏지 않는다(등록 화면의 URL 칸 autoFocus)
      const isFocusLeftBehind = focused === document.body || drawer?.contains(focused);

      if (isFocusLeftBehind && opener instanceof HTMLElement) {
        opener.focus({ preventScroll: true });
      }
    };
  }, [isMobileOpen]);

  // 포커스 effect와 나눈다 - close는 열림 상태가 바뀔 때 새로 만들어져, 합치면 포커스를 다시 옮길 수 있다.
  // 닫혀 있으면 close가 아무것도 하지 않는다(useHistoryOverlay.ts)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [close]);

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

      {/* 모바일: 드로어 백드롭 - 배경 스크롤 잠금 (RecentSearchPanel.tsx와 같은 이유) */}
      {isMobileOpen && (
        <RemoveScroll as={Slot} allowPinchZoom shards={[drawerRef]}>
          <div
            className="md:hidden fixed inset-0 z-scrim bg-scrim/50"
            onClick={close}
            aria-hidden="true"
          />
        </RemoveScroll>
      )}

      {/* 모바일: 드로어 패널 */}
      <aside
        ref={drawerRef}
        className={cn(
          'md:hidden fixed top-0 left-0 z-drawer h-full w-64 bg-background border-r flex flex-col',
          'duration-200',
          // invisible이라야 닫힌 메뉴가 키보드 이동·읽기 순서에서 빠진다. visibility를 트랜지션에 넣으면 닫는
          // 동안은 보이다 끝에 숨는다. 열 때는 트랜지션에서 빼야 바로 보여 위의 focus()가 통한다
          isMobileOpen
            ? 'translate-x-0 visible transition-[translate]'
            : '-translate-x-full invisible transition-[translate,visibility]'
        )}
      >
        <SidebarHeader expanded onToggle={close} showCloseIcon toggleRef={drawerCloseRef} />
        <nav className="flex flex-col gap-1 py-4 px-2">
          {NAV_ITEMS.map((item) => (
            <NavItem key={item.to} {...item} expanded />
          ))}
        </nav>
      </aside>
    </>
  );
}
