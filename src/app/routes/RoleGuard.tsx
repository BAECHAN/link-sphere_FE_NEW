import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/domains/auth/_common/model/auth.store';
import { ForbiddenPage } from '@/pages/403/ForbiddenPage';

interface RoleGuardProps {
  allowedRoles: string[];
}

export function RoleGuard({ allowedRoles }: RoleGuardProps) {
  const role = useAuthStore((state) => state.role);

  if (!role || !allowedRoles.includes(role)) {
    return <ForbiddenPage />;
  }

  return <Outlet />;
}
