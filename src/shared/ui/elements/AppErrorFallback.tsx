import { useEffect } from 'react';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { chunkReloadKey } from '@/shared/config/storage-keys';
import { ErrorUtil } from '@/shared/utils/error.util';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';
import { SpinnerOverlay } from '@/shared/ui/elements/SpinnerOverlay';

interface AppErrorFallbackProps {
  error: unknown;
}

/**
 * 최상위 크래시 화면 (Router 안/밖 양쪽에서 동일하게 동작)
 * - 청크 로드 실패 → 새 배포 가능성, 한 번만 자동 새로고침 (무한 루프 방지)
 * - 5xx / 네트워크 에러 → /500 페이지로 하드 이동
 * - 그 외 → 일반 안내 문구 (날것의 error.message는 노출하지 않는다)
 *
 * 이동은 모두 window.location(하드 내비게이션)을 쓴다 - Router 밖에서도 동작해야 하고,
 * 크래시 직후의 트리 상태를 믿을 수 없어 소프트 내비게이션은 같은 에러로 되돌아올 수 있다.
 */
export function AppErrorFallback({ error }: AppErrorFallbackProps) {
  const isChunkLoadError = ErrorUtil.isChunkLoadError(error);
  const isServerError = ErrorUtil.isServerError(error);

  useEffect(() => {
    if (isChunkLoadError) {
      const reloadKey = chunkReloadKey(window.location.pathname);
      if (!sessionStorage.getItem(reloadKey)) {
        sessionStorage.setItem(reloadKey, '1');
        window.location.reload();
      }
      return;
    }
    if (isServerError) {
      window.location.replace(ROUTES_PATHS.SERVER_ERROR);
    }
  }, [isChunkLoadError, isServerError]);

  if (isChunkLoadError || isServerError) {
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
