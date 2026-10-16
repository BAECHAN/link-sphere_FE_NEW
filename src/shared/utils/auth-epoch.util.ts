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
 *
 * 요청이 기억하는 세대(AuthEpoch)는 저장값과 함께 "탭 안 세대"(이 탭의 명시적 로그인·로그아웃 횟수, 메모리)를
 * 담는다. localStorage 쓰기가 실패하는 탭에서는 같은 탭에서 다른 계정으로 로그인해도 저장값이 그대로라, 그 전에 나간
 * 요청이 새 계정으로 재시도될 수 있었다(client.test.ts Case 9). 호출부는 토큰을 바꾼 직후에 기록한다(로그인은
 * setAuth 다음 markLogin, 로그아웃은 clearAuth 다음 markLogout) - 그 사이에 시작한 요청은 바뀌기 전 세대로 잡힌다.
 */
const KEY = STORAGE_KEYS.AUTH.EPOCH;

/** 요청·mutation이 시작할 때 기억해 두는 인증 세대 - 401이나 보내기 직전에 hasChangedSince로 비교한다 */
export interface AuthEpoch {
  /** 그 순간 이 탭 토큰이 속한 저장 세대(tokenEpoch) */
  stored: string | null;
  /** 그 순간의 탭 안 세대(inTabEpoch) */
  inTab: number;
}

const readStoredEpoch = (): string | null => LocalStorageUtil.getItem<string>(KEY);

/** 이 페이지가 마지막으로 맞춰 둔 세대. 모듈을 처음 불러올 때(= 페이지 로드) 저장값으로 시작한다 */
let knownEpoch = readStoredEpoch();

/**
 * 이 탭이 지금 들고 있는 토큰이 속한 세대. 토큰을 넣고 뺄 때(auth.store의 setAuth·clearAuth 등) 그 순간의
 * 저장값으로 맞춘다. knownEpoch와 다른 점: 다른 탭의 변화를 알아채고 acknowledge한 뒤에도 새 세션을 받아들이기
 * 전까지는 옛 토큰을 들고 있으므로, 그 사이 시작한 요청은 이 값(옛 세대)으로 잡혀야 한다(client.ts).
 */
let tokenEpoch = knownEpoch;

/**
 * 이 탭에서 명시적으로 로그인·로그아웃한 횟수. 저장이 실패해도 늘어나, 같은 탭의 계정 전환을 저장값 없이도 알아챈다.
 * hasChangedSince에만 쓴다 - isStale(다른 탭의 변화)에 섞으면 쓰기가 실패하는 탭이 자기 로그인을 다른 탭의 변화로
 * 보고 스스로 로그아웃한다(write 주석 참고).
 */
let inTabEpoch = 0;

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

  /** 이 탭이 지금 들고 있는 토큰이 속한 세대 - 요청을 시작할 때 기억해 둔다(client.ts) */
  static ofToken(): AuthEpoch {
    return { stored: tokenEpoch, inTab: inTabEpoch };
  }

  /** 토큰을 넣거나 뺀 직후 부른다 - 그 토큰은 지금 저장된 세대의 것이다(auth.store) */
  static bindToken(): void {
    tokenEpoch = readStoredEpoch();
  }

  /**
   * 기억해 둔 세대 이후 저장된 세대가 바뀌었거나 이 탭에서 명시적으로 로그인·로그아웃했나 - 그랬으면 그 사이 공유
   * 쿠키와 이 탭 토큰이 다른 계정의 것일 수 있다
   */
  static hasChangedSince(epoch: AuthEpoch): boolean {
    return readStoredEpoch() !== epoch.stored || inTabEpoch !== epoch.inTab;
  }

  /** 지금 저장값이 로그인으로 생긴 값인가 */
  static isLoginEpoch(): boolean {
    return readStoredEpoch()?.startsWith('in:') ?? false;
  }

  /** 테스트 격리용 - 저장값과 메모리를 비운다(src/test/setup.ts afterEach) */
  static reset(): void {
    LocalStorageUtil.removeItem(KEY);
    knownEpoch = null;
    tokenEpoch = null;
    inTabEpoch = 0;
  }

  private static write(kind: 'in' | 'out'): void {
    inTabEpoch += 1;
    LocalStorageUtil.setItem(KEY, `${kind}:${crypto.randomUUID()}`);
    // 쓴 뒤 다시 읽는다 - 저장이 실패하면(LocalStorageUtil이 예외를 삼킨다) 메모리도 저장값과 같게 남아,
    // 이 탭이 스스로를 "바뀜"으로 오판해 로그아웃하지 않는다. 쓴 탭에는 storage 이벤트가 오지 않으므로
    // 이 탭의 메모리를 맞추는 길은 이것뿐이다. 이 탭의 토큰도 이 세대의 것이다(로그인은 setAuth 뒤, 로그아웃은
    // 정리 뒤에 부른다).
    knownEpoch = readStoredEpoch();
    tokenEpoch = knownEpoch;
  }
}
