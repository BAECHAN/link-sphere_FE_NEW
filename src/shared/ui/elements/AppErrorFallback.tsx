import { useEffect, useState } from 'react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { ChunkReloadUtil } from '@/shared/utils/chunk-reload.util';
import { ErrorUtil } from '@/shared/utils/error.util';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

interface AppErrorFallbackProps {
  error: unknown;
}

/**
 * 최상위 크래시 화면 (Router 안/밖 양쪽에서 동일하게 동작)
 * - 청크 로드 실패 → 새 배포 가능성, 한 번만 자동 새로고침 (무한 루프 방지).
 *   새로고침하고도 같은 경로에서 또 실패하면 스피너 대신 아래 일반 안내 화면을 보여준다 -
 *   예전엔 이때도 스피너만 떠서 안내도 버튼도 없이 로딩이 끝나지 않았다(2026-10-14)
 * - 5xx / 네트워크 에러 → /500 페이지로 하드 이동
 * - 그 외 → 일반 안내 문구 (날것의 error.message는 노출하지 않는다)
 *
 * 이동은 모두 window.location(하드 내비게이션)을 쓴다 - Router 밖에서도 동작해야 하고,
 * 크래시 직후의 트리 상태를 믿을 수 없어 소프트 내비게이션은 같은 에러로 되돌아올 수 있다.
 */
export function AppErrorFallback({ error }: AppErrorFallbackProps) {
  const isChunkLoadError = ErrorUtil.isChunkLoadError(error);
  const isServerError = ErrorUtil.isServerError(error);
  // 곧 새로고침될 화면인지 마운트 때 한 번만 판단한다 - 아래 effect가 재시도 키를 기록한 뒤
  // 다시 렌더돼도 결과가 바뀌지 않게 한다(렌더는 idempotent해야 하고, 바뀌는 값은
  // useState 초기값으로 읽는다: https://react.dev/reference/rules/components-and-hooks-must-be-pure).
  // main.tsx 리스너가 이미 새로고침을 걸었으면 청크 에러로 판별되지 않는 실패(CSS 프리로드 등)도 기다린다.
  const [isReloadPending] = useState(
    () => ChunkReloadUtil.isReloading() || (isChunkLoadError && !ChunkReloadUtil.hasRetried())
  );

  useEffect(
    function handleCrashRecovery() {
      if (isChunkLoadError) {
        ChunkReloadUtil.reloadOnce();
        return;
      }
      if (isServerError) {
        window.location.replace(ROUTES_PATHS.SERVER_ERROR);
      }
    },
    [isChunkLoadError, isServerError]
  );

  if (isReloadPending || isServerError) {
    return <SpinnerOverlay />;
  }

  return (
    <ErrorLayout
      title={TEXTS.errors.unexpected.title}
      description={ErrorUtil.resolveMessage(error)}
      onHomeClick={() => window.location.assign(ROUTES_PATHS.HOME)}
    />
  );
}
