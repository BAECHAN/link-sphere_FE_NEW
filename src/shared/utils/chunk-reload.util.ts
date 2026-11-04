import { chunkReloadKey } from '@/shared/config/storage-keys';

/**
 * 이 페이지에서 이미 새로고침을 걸었는지 - reload()를 부른 뒤 페이지가 실제로 바뀌기 전까지
 * 같은 페이지에서 다른 청크 실패가 또 들어오면, 저장소에는 이미 키가 있어 "재시도 소진"으로
 * 잘못 읽힌다. 모듈 변수라 새로고침되면 자연히 false로 돌아간다.
 */
let isReloadInFlight = false;

/** 진행 중인 조용한 미리 받기(preloadQuietly) 수 - 겹쳐 불려도 마지막 것이 끝날 때까지 true로 읽히게 센다 */
let quietPreloadCount = 0;

/**
 * 새 배포 후 청크 로드 실패를 경로별로 세션당 1회 새로고침해 복구한다.
 *
 * main.tsx의 vite:preloadError 리스너와 AppErrorFallback(에러 경계)이 같은 판단을 공유한다 -
 * 둘이 sessionStorage만 각자 보면, 리스너가 먼저 키를 기록한 직후 렌더된 에러 경계가
 * "이미 한 번 시도했다"로 읽고 새로고침 직전에 에러 화면을 띄운다.
 */
export class ChunkReloadUtil {
  /**
   * 아직 이 경로에서 시도한 적이 없으면 기록하고 새로고침한다.
   * 새로고침을 걸었거나 이미 걸려 있으면 true, 이전 로드에서 이미 시도했으면 false.
   * 기록할 수 없으면(저장소 차단) 루프 가드가 없는 셈이라 새로고침하지 않고 false.
   */
  static reloadOnce(): boolean {
    if (isReloadInFlight) {
      return true;
    }

    const reloadKey = chunkReloadKey(window.location.pathname);

    try {
      if (sessionStorage.getItem(reloadKey) !== null) {
        return false;
      }

      sessionStorage.setItem(reloadKey, '1');
    } catch {
      return false;
    }

    isReloadInFlight = true;
    window.location.reload();

    return true;
  }

  /**
   * 사용자가 누르지 않은 청크 미리 받기 - 실패해도 새로고침하지 않고 조용히 끝낸다. main.tsx는 vite:preloadError마다
   * 새로고침하는데(Vite 6.4.1 preload 헬퍼는 본 모듈 import 실패에도 이 이벤트를 쏜다), 미리 받기 실패로 보던 화면이
   * 새로고침되면 안 된다. 실패한 import는 다시 부르면 새로 요청하므로(Chromium 156 실측) 실제로 그 화면에 갈 때 다시
   * 받고, 그때도 실패하면 에러 경계(AppErrorFallback)가 reloadOnce로 복구한다.
   */
  static async preloadQuietly(load: () => Promise<unknown>): Promise<void> {
    quietPreloadCount += 1;

    try {
      await load();
    } catch {
      // 실제로 이동할 때 다시 받으므로 여기서는 알리지 않는다
    } finally {
      quietPreloadCount -= 1;
    }
  }

  /**
   * 조용한 미리 받기가 진행 중인지 - 그동안 main.tsx 리스너는 새로고침하지 않는다. 이벤트에는 어느 import가
   * 실패했는지가 없어 이 동안 실패한 다른 청크도 리스너에서는 건너뛰지만, 화면을 그리던 청크라면 에러 경계가 복구한다
   */
  static isPreloadingQuietly(): boolean {
    return quietPreloadCount > 0;
  }

  /** 이 페이지에서 새로고침을 걸어 둔 상태인지 - 곧 페이지가 바뀐다 */
  static isReloading(): boolean {
    return isReloadInFlight;
  }

  /**
   * 이전 로드에서 이 경로로 이미 새로고침했는지(=다시 해도 소용없을 가능성이 크다).
   * 저장소를 읽을 수 없으면 reloadOnce도 새로고침하지 않으므로 true로 맞춘다.
   */
  static hasRetried(): boolean {
    if (isReloadInFlight) {
      return false;
    }

    try {
      return sessionStorage.getItem(chunkReloadKey(window.location.pathname)) !== null;
    } catch {
      return true;
    }
  }
}
