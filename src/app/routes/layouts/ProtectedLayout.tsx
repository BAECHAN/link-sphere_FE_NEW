import { Outlet } from 'react-router-dom';
import { ProtectedRoute } from '@/app/routes/ProtectedRoute';
import { AppLayout } from '@/shared/ui/layouts/AppLayout';

export function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}
