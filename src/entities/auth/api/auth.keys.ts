import type { Query, QueryClient } from '@tanstack/react-query';
import { postInvalidateQueries } from '@/entities/post/@x/auth';
import { accountInvalidateQueries } from '@/entities/account/@x/auth';

/** 데이터 없이 에러만 남은 캐시 - 로그아웃 상태로 받아 둔 401 결과 등(로그인 직후 리셋 대상) */
export function isErroredCacheWithoutData(query: Query): boolean {
  return query.state.status === 'error' && query.state.data === undefined;
}

/**
 * 세션 복원(refresh) 성공 시 포스트 목록 재검증.
 * 복원 전에 비로그인 상태로 이미 나간 공개 목록 요청이 있을 수 있으므로,
 * 복원된 인증 상태로 다시 가져오도록 무효화한다.
 */
export const handleAuthRestoreSuccess = (queryClient: QueryClient) => {
  postInvalidateQueries.list(queryClient);
};

/**
 * 다른 탭의 로그인을 이 탭이 쿠키로 받아들였을 때(useAuthEpochSync) - 로그인 성공(useLoginMutation
 * onSuccess)과 같은 캐시 처리다. 앱 시작 복원(handleAuthRestoreSuccess)은 복원이 끝날 때까지 화면이
 * 스피너라 글 목록만 다시 불러도 되지만, 이 경로는 이미 그려진 화면에서 일어나 비로그인으로 받아 둔
 * 상세·댓글·좋아요 여부가 남는다. 에러만 남은 캐시는 리셋하고 나머지는 새 인증으로 다시 불러온다.
 */
export const handleSessionAdoptedSuccess = (queryClient: QueryClient) => {
  void queryClient.resetQueries({ predicate: isErroredCacheWithoutData });
  void queryClient.invalidateQueries();
};

/**
 * 이메일 인증 확인 성공 시 계정 캐시를 재검증한다 - emailVerified가 true로 바뀌어야
 * Navbar 배지·MyAccountPage 안내가 실시간으로 사라진다.
 */
export const handleEmailVerificationConfirmSuccess = (queryClient: QueryClient) => {
  accountInvalidateQueries.root(queryClient);
};
