import { Outlet } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/app-layout/AppLayout';
import { useAuthStore, hasStoredSession } from '@/shared/store/auth.store';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

/**
 * App Shell Layout
 * 인증 게이트 없이 nav shell(AppLayout)만 렌더하는 레이아웃
 * 비로그인 사용자도 접근 가능한 공개 콘텐츠 페이지에 사용
 *
 * 단, 이전 로그인 흔적(linksphere:auth:has-session)이 있으면 인증 복원(isAuthResolved)이 끝날
 * 때까지 잠깐 기다린다. 그렇지 않으면 복원 전에 게시글 목록 등 공개 요청이 먼저
 * 나가 비로그인 취급되어 본인 비공개 글이 누락된다. 흔적이 없는 완전 비로그인
 * 방문자는 기다릴 게 없으므로 즉시 렌더한다(기존 성능 유지).
 */
export function AppShellLayout() {
  const isAuthResolved = useAuthStore((state) => state.isAuthResolved);

  if (!isAuthResolved && hasStoredSession()) {
    return <SpinnerOverlay className="h-screen" />;
  }

  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
}
