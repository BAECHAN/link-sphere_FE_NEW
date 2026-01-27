import { memo } from 'react';
import { Outlet } from 'react-router-dom';
import { AuthLayout } from '@/shared/ui/layouts/AuthLayout';

/**
 * Public Routes Layout
 * AuthLayout을 포함한 공개 라우트 레이아웃
 * React.memo로 최적화하여 불필요한 리렌더링 방지
 */
export const PublicLayout = memo(function PublicLayout() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
});
