import { ProtectedRoute } from '@/app/routes/ProtectedRoute';
import { AppShellLayout } from '@/app/routes/layouts/AppShellLayout';

export function ProtectedLayout() {
  return (
    <ProtectedRoute>
      <AppShellLayout />
    </ProtectedRoute>
  );
}
