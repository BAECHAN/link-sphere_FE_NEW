import { Button } from '@/shared/ui/atoms/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/ui/atoms/card';
import { BUILD_INFO } from '@/shared/config/build-info';
import { TEXTS } from '@/shared/config/texts';
import { useDeployedBuildInfo } from '@/shared/hooks/useDeployedBuildInfo';
import { cn } from '@/shared/lib/tailwind/utils';
import { DateUtil } from '@/shared/utils/date.util';
import { VersionUtil } from '@/shared/utils/version.util';

const GITHUB_REPO_URL = 'https://github.com/BAECHAN/link-sphere_FE_NEW';

type SyncStatus = 'match' | 'mismatch' | 'checkFailed';

const STATUS_BANNER_CLASSNAME: Record<SyncStatus, string> = {
  match: 'bg-success text-success-foreground',
  mismatch: 'bg-warning text-warning-foreground',
  checkFailed: 'bg-muted text-muted-foreground',
};

const STATUS_BANNER_TEXT: Record<SyncStatus, string> = {
  match: TEXTS.version.bannerMatch,
  mismatch: TEXTS.version.bannerMismatch,
  checkFailed: TEXTS.version.checkFailedNotice,
};

/** 로드된 빌드와 서버에 배포된 빌드를 나란히 보여준다 - "배포는 됐는데 내 탭이 옛날 것을 보고
 * 있다"와 "애초에 배포가 안 됐다"를 구분하는 게 이 화면의 유일한 목적이다.
 *
 * 동기화 상태 배너를 페이지 맨 위, 카드보다 먼저 둔다 - 이 화면의 존재 이유가 바로 그
 * 판정이라 스크롤 없이 가장 먼저 보여야 한다(2026-09-20 사용자 요청, Statuspage/Vercel
 * 색상 규칙 참고). checkFailed(서버 조회 자체가 실패)는 mismatch와 다른 muted 색으로
 * 구분한다 - 배포 문제가 아니라 내 네트워크 문제일 수도 있어서 warning/destructive처럼
 * 경고색을 쓰면 실제 배포 실패로 오인할 수 있다. */
export function VersionPage() {
  const { deployedBuildInfo, deployedEntryScript, isLoading } = useDeployedBuildInfo();
  const loadedEntryScript = VersionUtil.readEntryScriptSrc(document);
  const isMatch = Boolean(deployedBuildInfo) && deployedBuildInfo?.sha === BUILD_INFO.sha;
  const status: SyncStatus | null = isLoading
    ? null
    : deployedBuildInfo
      ? isMatch
        ? 'match'
        : 'mismatch'
      : 'checkFailed';

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-screen-title text-foreground">{TEXTS.version.title}</h1>
          <p className="text-muted-foreground">{TEXTS.version.description}</p>
        </div>

        {!import.meta.env.DEV && status && (
          <div
            className={cn('rounded-lg p-4 flex items-start gap-3', STATUS_BANNER_CLASSNAME[status])}
          >
            <span className="mt-1 inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-current" />
            <div className="flex-1 space-y-2">
              {/* 페이지 제목(h1)이 아니라 배너 안 상태 문구다 - 역할 토큰(text-screen-title 등)은
               * 전부 제목용이라 여기 안 맞는다 */}
              {/* eslint-disable-next-line custom-tailwind/no-raw-title */}
              <p className="text-sm font-bold">{STATUS_BANNER_TEXT[status]}</p>
              {status === 'mismatch' && deployedBuildInfo && (
                <div className="flex items-center gap-3">
                  <a
                    href={`${GITHUB_REPO_URL}/compare/${BUILD_INFO.sha}...${deployedBuildInfo.sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm underline underline-offset-4"
                  >
                    {TEXTS.version.viewChanges}
                  </a>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-transparent"
                    onClick={() => {
                      window.location.reload();
                    }}
                  >
                    {TEXTS.version.reload}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{TEXTS.version.loadedBuild}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <p>
              <a
                href={`${GITHUB_REPO_URL}/commit/${BUILD_INFO.sha}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline underline-offset-4"
              >
                {BUILD_INFO.sha.slice(0, 7)}
              </a>{' '}
              <span className="text-muted-foreground">({BUILD_INFO.ref})</span>
            </p>
            {/* dev 서버는 첫 script[type=module]이 Vite HMR 클라이언트(/@vite/client)라
             * VersionUtil.readEntryScriptSrc가 실제 엔트리(/src/main.tsx)를 가리키지 않는다.
             * useAppVersionCheck도 같은 이유로 DEV에서는 이 값을 안 쓴다 - 프로덕션에서만 의미있다. */}
            {!import.meta.env.DEV && (
              <p className="text-muted-foreground">
                {TEXTS.version.entryScript}: {loadedEntryScript ?? '—'}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{TEXTS.version.deployedBuild}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {import.meta.env.DEV && (
              <p className="text-muted-foreground">{TEXTS.version.devModeNotice}</p>
            )}
            {deployedBuildInfo && (
              <>
                <p>
                  <a
                    href={`${GITHUB_REPO_URL}/commit/${deployedBuildInfo.sha}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary underline underline-offset-4"
                  >
                    {deployedBuildInfo.sha.slice(0, 7)}
                  </a>{' '}
                  <span className="text-muted-foreground">({deployedBuildInfo.ref})</span>
                </p>
                <p className="text-muted-foreground">
                  {TEXTS.version.deployedAt}:{' '}
                  {DateUtil.formatKoreanDateTime(deployedBuildInfo.builtAt)}
                </p>
                {deployedBuildInfo.runNumber && (
                  <p className="text-muted-foreground">
                    {TEXTS.version.runNumber}: #{deployedBuildInfo.runNumber}
                  </p>
                )}
                <p className="text-muted-foreground">
                  {TEXTS.version.entryScript}: {deployedEntryScript ?? '—'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <a
          href={`${GITHUB_REPO_URL}/blob/${BUILD_INFO.sha}/CHANGELOG.md`}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-sm text-primary underline underline-offset-4"
        >
          {TEXTS.version.viewChangelog}
        </a>
      </div>
    </div>
  );
}
