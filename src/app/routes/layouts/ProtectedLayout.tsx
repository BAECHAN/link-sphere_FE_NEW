import { Outlet } from 'react-router-dom';
import { ProtectedRoute } from '@/app/routes/ProtectedRoute';
import { AppLayout } from '@/shared/ui/layouts/AppLayout';
import { usePostAIEvents } from '@/domains/post/_common/hooks/usePostAIEvents';

export function ProtectedLayout() {
  // AI 분석 완료 SSE 구독 (인증된 사용자 전체에서 활성화)
  usePostAIEvents();

  return (
    <ProtectedRoute>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </ProtectedRoute>
  );
}
