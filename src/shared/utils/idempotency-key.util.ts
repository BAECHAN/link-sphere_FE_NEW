import dayjs from 'dayjs';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { SessionStorageUtil } from '@/shared/utils/storage.util';

// 응답을 못 받은 키를 잡아 두는 개수·시간. 쌓이지 않게 둘 다 제한한다 - 20개는 판단값이고, 1시간은 글의 서버 중복 창에 맞췄다
const MAX_PENDING_KEYS = 20;
const PENDING_KEY_TTL_MS = 60 * 60 * 1000;

interface PendingKey {
  content: string;
  key: string;
  savedAt: number;
}

function readPending(): PendingKey[] {
  const entries = SessionStorageUtil.getItem<PendingKey[]>(STORAGE_KEYS.IDEMPOTENCY.PENDING) ?? [];

  return entries.filter((entry) => dayjs().valueOf() - entry.savedAt < PENDING_KEY_TTL_MS);
}

/**
 * 등록 요청의 Idempotency-Key를 내용별로 구한다. 응답을 못 받고 끝나면 키를 남겨, 같은 내용을 다시 보낼 때 서버가
 * 같은 시도로 알아보고 새로 만들지 않게 한다. 새로고침해도 keepalive 요청은 끝까지 가므로 메모리가 아니라
 * sessionStorage에 둔다. content는 키를 찾는 데만 쓰고 서버로 보내지 않는다(docs/FE-ARCHITECTURE.md §27).
 */
export class IdempotencyKeyUtil {
  /** 같은 내용의 키가 남아 있으면 재사용해 요청하고, 성공하면 그 키를 버린다. 실패하면 다음 재시도를 위해 남긴다 */
  static async send<T>(content: string, request: (key: string) => Promise<T>): Promise<T> {
    const pending = readPending();
    const key = pending.find((entry) => entry.content === content)?.key ?? crypto.randomUUID();
    const others = pending.filter((entry) => entry.content !== content);

    SessionStorageUtil.setItem(
      STORAGE_KEYS.IDEMPOTENCY.PENDING,
      [...others, { content, key, savedAt: dayjs().valueOf() }].slice(-MAX_PENDING_KEYS)
    );

    const result = await request(key);
    const remaining = readPending().filter((entry) => entry.content !== content);

    SessionStorageUtil.setItem(STORAGE_KEYS.IDEMPOTENCY.PENDING, remaining);

    return result;
  }

  /** 명시적 로그아웃·탈퇴 때 비운다. 로그인 만료는 입력을 남겨 재시도하므로 비우지 않는다 */
  static clear(): void {
    SessionStorageUtil.removeItem(STORAGE_KEYS.IDEMPOTENCY.PENDING);
  }
}
