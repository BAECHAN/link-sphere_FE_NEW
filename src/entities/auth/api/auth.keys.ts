import type { QueryClient } from '@tanstack/react-query';
import { postInvalidateQueries } from '@/entities/post/@x/auth';
import { accountInvalidateQueries } from '@/entities/account/@x/auth';

/**
 * 세션 복원(refresh) 성공 시 포스트 목록 재검증.
 * 복원 전에 비로그인 상태로 이미 나간 공개 목록 요청이 있을 수 있으므로,
 * 복원된 인증 상태로 다시 가져오도록 무효화한다.
 */
export const handleAuthRestoreSuccess = (queryClient: QueryClient) => {
  postInvalidateQueries.list(queryClient);
};

/**
 * 이메일 인증 확인 성공 시 계정 캐시를 재검증한다 - emailVerified가 true로 바뀌어야
 * Navbar 배지·MyAccountPage 안내가 실시간으로 사라진다.
 */
export const handleEmailVerificationConfirmSuccess = (queryClient: QueryClient) => {
  accountInvalidateQueries.root(queryClient);
};
