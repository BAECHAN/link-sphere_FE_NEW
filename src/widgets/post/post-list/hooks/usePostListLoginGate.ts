import { useSearchParams } from 'react-router-dom';
import { useAuthGuard } from '@/entities/auth/hooks/useAuthGuard';
import { hasLoginOnlyFilter } from '@/widgets/post/post-list/utils/post-list-payload';
import { useAuthStore } from '@/shared/store/auth.store';

/** 로그인하면 목록이 스스로 그려진다 - 안내의 로그인 버튼은 로그인 뒤에 따로 할 일이 없다 */
function doNothingAfterLogin() {
  return;
}

/**
 * 로그아웃 상태인데 주소에 로그인 전용 범위 필터가 남아 있는지(칩을 켠 채 로그아웃·로그인 만료, 그 주소로
 * 바로 진입). 참이면 목록과 미리 받기를 요청하지 않고 목록 자리에 로그인 안내를 둔다 - 그대로 요청하면
 * 서버가 물어본 조건과 다른 답을 주거나 거절한다(docs/SEARCH.md 범위 칩).
 * 목록 화면(PostList)과 피드 라우트의 미리 받기(AppRoutes)가 함께 쓴다. 미리 받기는 lazy 페이지 청크 밖에서
 * 돌므로 usePostList.ts를 import하지 않고, 주소는 usePostFeedPrefetch와 같은 커밋된 값에서 읽는다.
 */
export function usePostListLoginGate() {
  const [searchParams] = useSearchParams();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const guard = useAuthGuard();

  const needsLogin =
    !isAuthenticated && hasLoginOnlyFilter(searchParams.get('filter') || undefined);

  // 로그인이 풀린 채 남은 화면이면 가드가 그 이유를 알리는 창으로 연다
  const handleSignIn = () => {
    guard(doNothingAfterLogin);
  };

  return { needsLogin, handleSignIn };
}
