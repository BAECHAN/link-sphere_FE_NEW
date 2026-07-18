import { Outlet } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/app-layout/AppLayout';

/**
 * App Shell Layout
 * 인증 게이트 없이 nav shell(AppLayout)만 렌더하는 레이아웃
 * 비로그인 사용자도 접근 가능한 공개 콘텐츠 페이지에 사용
 */
export function AppShellLayout() {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
