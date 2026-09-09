import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useAppVersionStore } from '@/shared/store/appVersion.store';

/**
 * 새 배포가 감지된 뒤 첫 라우트 이동을 full page load로 바꾼다. UI는 없다.
 *
 * useBlocker로 이동을 가로채지 않는다 - react-router는 blocker를 하나만 허용하고
 * (@remix-run/router의 router.js: blockerFunctions.size > 1이면 마지막 것만 사용)
 * 두 번째를 등록하면 useUnsavedChangesGuard의 폼 이탈 가드가 조용히 죽는다.
 * 대신 이동이 끝난 뒤(pathname이 바뀐 렌더)에 판단하고, 호출부는 반환값이 true인 동안
 * Outlet 대신 로딩 화면을 렌더해 구 빌드가 새 라우트를 그리지 않게 한다
 * (AppErrorFallback의 청크 에러 처리와 같은 형태).
 *
 * 이 시점엔 react-router가 history를 이미 목적지로 밀어둔 뒤라(completeNavigation은
 * history.push 후에 updateState를 호출한다) reload()가 목적지를 그대로 다시 연다 -
 * assign()과 달리 히스토리 항목이 늘지 않아 뒤로가기가 정상 동작한다.
 *
 * pathname만 비교한다 - 쿼리스트링만 바뀌는 이동(북마크 폴더 전환 등)까지 잡으면
 * 과도하다. useUnsavedChangesGuard가 같은 이유로 쓰는 규칙과 맞췄다.
 *
 * @returns 리로드를 시작했는지 - true면 호출부는 페이지 대신 로딩 화면을 렌더한다
 */
export function useNewVersionReload(): boolean {
  const detectedAtPathname = useAppVersionStore((state) => state.detectedAtPathname);
  const location = useLocation();

  const shouldReload = detectedAtPathname !== null && location.pathname !== detectedAtPathname;

  useEffect(
    function reloadOnRouteChange() {
      if (!shouldReload) {
        return;
      }

      window.location.reload();
    },
    [shouldReload]
  );

  return shouldReload;
}
