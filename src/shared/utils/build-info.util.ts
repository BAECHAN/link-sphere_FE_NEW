/** 서버(/version.json)에 지금 올라가 있는 빌드 정보. deploy.yml이 dist/index.html과 같은 이유로
 * no-store로 올린다 - 캐시되면 "지금 서버 상태"라는 이 파일의 존재 이유가 무너진다. */
interface DeployedBuildInfo {
  sha: string;
  ref: string;
  mode: string;
  runNumber: string | null;
  runId: string | null;
  builtAt: string;
}

function isDeployedBuildInfo(value: unknown): value is DeployedBuildInfo {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate = value as Record<string, unknown>;

  return typeof candidate.sha === 'string' && typeof candidate.builtAt === 'string';
}

export class BuildInfoUtil {
  /**
   * 서버에 지금 올라가 있는 /version.json을 읽는다.
   * 네트워크 실패·비정상 응답·형식 불일치는 전부 null - VersionUtil.fetchDeployedEntryScriptSrc와
   * 같은 "조용히 판단 보류" 계약을 따른다.
   */
  static async fetchDeployedBuildInfo(): Promise<DeployedBuildInfo | null> {
    try {
      const response = await fetch('/version.json', { cache: 'no-store' });

      if (!response.ok) {
        return null;
      }

      const json: unknown = await response.json();

      if (!isDeployedBuildInfo(json)) {
        return null;
      }

      return json;
    } catch {
      return null;
    }
  }
}

export type { DeployedBuildInfo };
