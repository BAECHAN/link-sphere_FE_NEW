import { useEffect, useState } from 'react';
import { BuildInfoUtil, type DeployedBuildInfo } from '@/shared/utils/build-info.util';
import { VersionUtil } from '@/shared/utils/version.util';

/**
 * 서버에 지금 올라가 있는 빌드 정보를 마운트 시 1회 조회한다.
 * dev 서버는 dist/를 서빙하지 않아 /version.json이 없으므로 DEV 모드에서는 fetch 자체를
 * 하지 않는다(useAppVersionCheck.ts의 같은 규약).
 *
 * entry script도 함께 조회한다 - useAppVersionCheck가 실제로 비교하는 값이 바로 이것이라,
 * "왜 자동 새로고침이 안 떴지?"를 코드를 읽지 않고 진단하려면 sha뿐 아니라 이 값도 화면에
 * 보여야 한다(VersionUtil은 수정하지 않고 그대로 재사용).
 *
 * 1회성 정적 파일 조회라 react-query 캐시 계층은 과잉이라 useState/useEffect로 둔다.
 */
export function useDeployedBuildInfo() {
  const [deployedBuildInfo, setDeployedBuildInfo] = useState<DeployedBuildInfo | null>(null);
  const [deployedEntryScript, setDeployedEntryScript] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!import.meta.env.DEV);

  useEffect(function fetchDeployedBuildInfoOnMount() {
    if (import.meta.env.DEV) {
      return;
    }

    let isMounted = true;

    const fetchBuildInfo = async () => {
      const [buildInfoResult, entryScriptResult] = await Promise.all([
        BuildInfoUtil.fetchDeployedBuildInfo(),
        VersionUtil.fetchDeployedEntryScriptSrc(),
      ]);

      if (!isMounted) {
        return;
      }

      setDeployedBuildInfo(buildInfoResult);
      setDeployedEntryScript(entryScriptResult);
      setIsLoading(false);
    };

    void fetchBuildInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  return { deployedBuildInfo, deployedEntryScript, isLoading };
}
