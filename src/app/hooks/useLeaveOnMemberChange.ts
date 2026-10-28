import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { ROUTES_PATHS, isProtectedPath } from '@/shared/config/route-paths';
import { useAuthStore } from '@/shared/store/auth.store';
import { clearAllUnsavedChanges, hasUnsavedChanges } from '@/shared/store/unsavedChanges.store';

/**
 * 로그인이 풀린 채 둔 화면에서 다른 회원으로 바뀌면 이전 회원의 것을 버리고 피드로 간다
 * (docs/plans/2026-10-28-keep-writing-in-place.md 결정 6). 로그인이 풀려도 쓰던 화면에 그대로 두므로, 그 자리에서 다른
 * 계정으로 로그인하면(로그인 창, 다른 탭의 로그인을 받아들임) 이전 회원이 쓰던 글이 새 회원 화면에 남는다.
 * - 쓰는 중이면 화면 종류와 상관없이 떠난다(공개 화면의 댓글도).
 * - 보호 화면이면 쓰는 중이 아니어도 떠난다 - 그 화면은 캐시를 남겨 둔 채라 이전 회원의 데이터가 보인다(글 수정 화면은
 *   다시 불러오기가 실패해도 이전 값을 그대로 둔다).
 *
 * 이탈 확인 등록을 먼저 모두 비운다 - 남겨 두면 이 이동을 이탈 확인창이 막고, "계속 작성"을 고른 새 회원이 이전 회원의
 * 글을 보게 된다. 확인 없이 떠나는 이유도 같다.
 *
 * 로그아웃 상태(계정 없음)를 거쳐도 비교할 수 있게 마지막으로 본 회원 id를 붙잡아 두되, 그 자리에 두지 않은 로그아웃이면
 * 놓는다 - 그때는 이전 회원의 글이 남아 있지 않고(직접 로그아웃은 확인 뒤 버리고, 그 자리를 떠날 때도 버린다), 붙잡아 두면
 * 그 뒤 비로그인으로 새로 쓴 글을 다른 계정으로 로그인하는 순간 버리게 된다. 렌더에 쓰지 않는 값이라 ref로 들고 effect에서만
 * 읽고 쓴다(https://react.dev/reference/react/useRef).
 *
 * data router 컨텍스트가 필요하며, 앱 전체에서 RootLayout 한 곳에서만 호출한다.
 */
export function useLeaveOnMemberChange() {
  const { account } = useAccount();
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isSignedOutInPlace = useAuthStore((state) => state.signedOutInPlace !== null);
  const memberId = account?.id ?? null;
  const lastMemberIdRef = useRef<string | null>(null);

  useEffect(
    function forgetMemberWhenSignedOutForGood() {
      if (isAuthenticated || isSignedOutInPlace) {
        return;
      }

      lastMemberIdRef.current = null;
    },
    [isAuthenticated, isSignedOutInPlace]
  );

  useEffect(
    function leaveWhenMemberChanges() {
      if (!memberId) {
        return;
      }

      const lastMemberId = lastMemberIdRef.current;
      lastMemberIdRef.current = memberId;

      if (!lastMemberId || lastMemberId === memberId) {
        return;
      }

      if (!hasUnsavedChanges() && !isProtectedPath(window.location.pathname)) {
        return;
      }

      clearAllUnsavedChanges();
      navigate(ROUTES_PATHS.POST.ROOT, { replace: true });
    },
    [memberId, navigate]
  );
}
