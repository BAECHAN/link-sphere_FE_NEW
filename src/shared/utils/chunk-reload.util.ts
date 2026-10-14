import { chunkReloadKey } from '@/shared/config/storage-keys';

/**
 * 이 페이지에서 이미 새로고침을 걸었는지 - reload()를 부른 뒤 페이지가 실제로 바뀌기 전까지
 * 같은 페이지에서 다른 청크 실패가 또 들어오면, 저장소에는 이미 키가 있어 "재시도 소진"으로
 * 잘못 읽힌다. 모듈 변수라 새로고침되면 자연히 false로 돌아간다.
 */
let isReloadInFlight = false;

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
