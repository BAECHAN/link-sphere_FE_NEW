import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { LocalStorageUtil } from '@/shared/utils/storage.util';

/**
 * 인증 세대(epoch) - 이 브라우저에서 명시적 로그인·로그아웃이 일어날 때마다 바뀌는 localStorage 값.
 *
 * 다른 탭과 bfcache로 되살아난 페이지가 "내가 알던 뒤로 인증 상태가 바뀌었는가"를 알아채는 데 쓴다
 * (useAuthEpochSync). 로그인은 `in:<UUID>`, 로그아웃·탈퇴는 `out:<UUID>`다. 로그아웃도 키를 지우지 않고
 * 새 값을 쓴다 - 지우면 이 키가 생기기 전에 로그인한 사용자의 로그아웃이 null → null이라 아무도 못 알아챈다.
 *
 * 토큰 갱신·앱 시작 복원·갱신 실패 정리에서는 바꾸지 않는다(그래서 setAuth/clearAuth 안이 아니라 호출부에서
 * 쓴다) - 한 탭의 네트워크 오류가 모든 탭을 로그아웃시키지 않게 하려는 것이다. 무작위 값이라 민감정보가 아니다.
 */
const KEY = STORAGE_KEYS.AUTH.EPOCH;

const readStoredEpoch = (): string | null => LocalStorageUtil.getItem<string>(KEY);

/** 이 페이지가 마지막으로 맞춰 둔 세대. 모듈을 처음 불러올 때(= 페이지 로드) 저장값으로 시작한다 */
let knownEpoch = readStoredEpoch();

export class AuthEpochUtil {
  /** 이 탭에서 명시적으로 로그인했다 */
  static markLogin(): void {
    this.write('in');
  }

  /** 이 탭에서 명시적으로 로그아웃(또는 탈퇴)했다 */
  static markLogout(): void {
    this.write('out');
  }

  /** 저장값이 이 페이지가 알던 값과 다른가 - 다른 탭의 로그인·로그아웃, 또는 bfcache에 멈춰 있던 사이의 변화 */
  static isStale(): boolean {
    return readStoredEpoch() !== knownEpoch;
  }

  /** 지금 저장값을 이 페이지가 아는 값으로 삼는다 */
  static acknowledge(): void {
    knownEpoch = readStoredEpoch();
  }

  /** 지금 저장값이 로그인으로 생긴 값인가 */
  static isLoginEpoch(): boolean {
    return readStoredEpoch()?.startsWith('in:') ?? false;
  }

  /** 테스트 격리용 - 저장값과 메모리를 비운다(src/test/setup.ts afterEach) */
  static reset(): void {
    LocalStorageUtil.removeItem(KEY);
    knownEpoch = null;
  }

  private static write(kind: 'in' | 'out'): void {
    LocalStorageUtil.setItem(KEY, `${kind}:${crypto.randomUUID()}`);
    // 쓴 뒤 다시 읽는다 - 저장이 실패하면(LocalStorageUtil이 예외를 삼킨다) 메모리도 저장값과 같게 남아,
    // 이 탭이 스스로를 "바뀜"으로 오판해 로그아웃하지 않는다. 쓴 탭에는 storage 이벤트가 오지 않으므로
    // 이 탭의 메모리를 맞추는 길은 이것뿐이다.
    knownEpoch = readStoredEpoch();
  }
}
