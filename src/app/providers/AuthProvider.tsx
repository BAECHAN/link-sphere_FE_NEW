import { useAppInitialization } from '@/entities/user/hooks/useAppInitialization';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * 인증 복원을 시작하되 렌더를 막지 않는다.
 *
 * 예전에는 복원이 끝날 때까지 전체 화면 스피너를 띄웠는데, 그러면 라우터 자체가
 * 생성되지 않아 라우트 청크 다운로드와 목록 조회가 인증 요청 뒤로 직렬화됐다.
 * 지금은 셸을 즉시 그리고 복원은 백그라운드로 돌린다.
 *
 * 대신 인증이 필요한 화면은 ProtectedRoute가 isAuthResolved를 기다린다.
 */
export function AuthProvider({ children }: AuthProviderProps) {
  useAppInitialization();

  return <>{children}</>;
}
