import type { QueryClient } from '@tanstack/react-query';
import { postInvalidateQueries } from '@/entities/post/@x/auth';

/**
 * 세션 복원(refresh) 성공 시 포스트 목록 재검증.
 * 복원 전에 비로그인 상태로 이미 나간 공개 목록 요청이 있을 수 있으므로,
 * 복원된 인증 상태로 다시 가져오도록 무효화한다.
 */
export const handleAuthRestoreSuccess = (queryClient: QueryClient) => {
  postInvalidateQueries.list(queryClient);
};
