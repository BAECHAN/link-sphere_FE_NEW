import { useEffect, useRef } from 'react';
import dayjs from 'dayjs';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { useAppVersionStore } from '@/shared/store/appVersion.store';
import { SessionStorageUtil } from '@/shared/utils/storage.util';
import { VersionUtil } from '@/shared/utils/version.util';

/** 마지막 확인 후 이 시간이 지나야 다시 확인한다 - 탭을 자주 오가도 요청이 쌓이지 않게 한다 */
export const VERSION_CHECK_THROTTLE_MS = 1000 * 60 * 5;

/**
 * 탭 포커스가 돌아올 때 서버의 index.html을 확인해 새 배포 여부를 플래그로만 남긴다.
 * 화면에는 아무것도 띄우지 않는다 - 적용은 useNewVersionReload가 라우트 이동 시점에 한다.
 *
 * window focus 구독 방식은 useWindowFocusManager를 그대로 따랐다. setInterval 폴링은 하지 않는다.
 * dev 서버에서는 진입 스크립트가 /src/main.tsx라 비교가 무의미하므로 아무것도 하지 않는다.
 * 앱 전체에서 RootLayout 한 곳에서만 호출한다.
 */
export function useAppVersionCheck() {
  const markNewVersionDetected = useAppVersionStore((state) => state.markNewVersionDetected);
  // 부팅 자체가 index.html을 막 받아온 시점이므로 마운트 시각을 마지막 확인 시각으로 친다
  const lastCheckedAtRef = useRef(dayjs().valueOf());

  useEffect(
    function checkDeployedVersionOnFocus() {
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

      window.addEventListener('focus', handleFocus);

      return () => window.removeEventListener('focus', handleFocus);
    },
    [markNewVersionDetected]
  );
}
