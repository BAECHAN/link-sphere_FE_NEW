import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { useAppVersionStore } from '@/shared/store/appVersion.store';
import { SessionStorageUtil } from '@/shared/utils/storage.util';
import { VersionUtil } from '@/shared/utils/version.util';

/** 마지막 확인 후 이 시간이 지나야 다시 확인한다 - 탭을 자주 오가도 요청이 쌓이지 않게 한다 */
export const VERSION_CHECK_THROTTLE_MS = 1000 * 60 * 5;

/**
 * 탭으로 돌아올 때(창 포커스 또는 탭이 다시 보일 때) 서버의 index.html을 확인해 새 배포 여부를
 * 플래그로만 남긴다. 화면에는 아무것도 띄우지 않는다 - 적용은 useNewVersionReload가 라우트 이동
 * 시점에 한다.
 *
 * window focus와 visibilitychange(visible)를 함께 듣는다 - visibilitychange는 앱·탭 전환 후 돌아올 때
 * focus가 오지 않는 경우를 메우려는 것이다(추론, 기기별로 측정하지 않았다). TanStack Query v5도 창
 * 포커스 감지를 focus 대신 visibilitychange로만 하도록 바꿨고, React Query 재조회는 그 기본을 그대로
 * 쓴다(https://tanstack.com/query/latest/docs/framework/react/guides/migrating-to-v5). 여기서 focus를
 * 빼지 않는 이유는 데스크톱 창 전환처럼 가시성은 그대로인 복귀도 잡기 위해서다. 두 이벤트가 연달아
 * 와도 아래 스로틀이 한 번만 확인하게 한다. 뒤로가기로 bfcache에서 되살아날 때(pageshow persisted)도
 * 같은 확인을 한다. setInterval 폴링은 하지 않는다.
 * dev 서버에서는 첫 module script가 /@vite/client라 비교가 무의미하므로 아무것도 하지 않는다.
 * 앱 전체에서 RootLayout 한 곳에서만 호출한다.
 */
export function useAppVersionCheck() {
  const markNewVersionDetected = useAppVersionStore((state) => state.markNewVersionDetected);
  // 부팅 자체가 index.html을 막 받아온 시점이므로 마운트 시각을 마지막 확인 시각으로 친다
  const lastCheckedAtRef = useRef(dayjs().valueOf());

  useEffect(
    function checkDeployedVersionOnReturn() {
      if (import.meta.env.DEV) {
        return;
      }

      const currentSrc = VersionUtil.readEntryScriptSrc(document);

      if (!currentSrc) {
        return;
      }

      const checkDeployedVersion = async () => {
        const now = dayjs().valueOf();

        if (now - lastCheckedAtRef.current < VERSION_CHECK_THROTTLE_MS) {
          return;
        }

        // 응답을 기다리는 동안 포커스가 여러 번 오가도 요청이 겹치지 않게 먼저 찍는다.
        // 실패했을 때도 되돌리지 않는다 - 오프라인 상태에서 포커스마다 재시도하면 요청만 쌓인다.
        lastCheckedAtRef.current = now;

        const deployedSrc = await VersionUtil.fetchDeployedEntryScriptSrc();

        if (!deployedSrc || deployedSrc === currentSrc) {
          return;
        }

        // 같은 값으로 이미 한 번 감지했다면 다시 걸지 않는다.
        // CloudFront 엣지가 잠시 옛 index.html을 돌려주면 리로드 → 재감지 → 리로드 루프가 된다.
        if (
          SessionStorageUtil.getItem<string>(STORAGE_KEYS.VERSION.LAST_DETECTED) === deployedSrc
        ) {
          return;
        }

        SessionStorageUtil.setItem(STORAGE_KEYS.VERSION.LAST_DETECTED, deployedSrc);
        markNewVersionDetected(window.location.pathname);
      };

      const handleFocus = () => {
        void checkDeployedVersion();
      };

      const handleVisibilityChange = () => {
        if (document.visibilityState !== 'visible') {
          return;
        }

        void checkDeployedVersion();
      };

      // 뒤로가기로 bfcache에서 되살아난 페이지는 그 사이 배포가 있었을 수 있다. Chromium은 복원 때
      // visibilitychange도 보내지만(2026-10-14 실측) 다른 브라우저를 위해 pageshow(persisted)도 듣는다
      const handlePageShow = (event: PageTransitionEvent) => {
        if (!event.persisted) {
          return;
        }

        void checkDeployedVersion();
      };

      window.addEventListener('focus', handleFocus);
      document.addEventListener('visibilitychange', handleVisibilityChange);
      window.addEventListener('pageshow', handlePageShow);

      return () => {
        window.removeEventListener('focus', handleFocus);
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('pageshow', handlePageShow);
      };
    },
    [markNewVersionDetected]
  );
}
