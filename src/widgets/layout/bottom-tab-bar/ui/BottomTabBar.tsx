import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/shared/lib/tailwind/utils';
import { NAV_ITEMS } from '@/shared/config/nav-items';
import { useProtectedNavigate } from '@/entities/user/hooks/useProtectedNavigate';

export function BottomTabBar() {
  const { pathname } = useLocation();
  const protectedNavigate = useProtectedNavigate();

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-50 border-t bg-background pb-[env(safe-area-inset-bottom)]">
      <div className="flex h-16">
        {NAV_ITEMS.map(({ to, icon: Icon, label, isActive, requiresAuth }) => {
          const active = isActive(pathname);
          return (
            <Link
              key={to}
              to={to}
              onClick={
                requiresAuth
                  ? (e) => {
                      e.preventDefault();
                      protectedNavigate(to);
                    }
                  : undefined
              }
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1',
                active && 'bg-accent'
              )}
            >
              <Icon className={cn('h-5 w-5', active ? 'text-primary' : 'text-muted-foreground')} />
              <span
                className={cn(
                  'text-xs font-medium leading-tight',
                  active ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
