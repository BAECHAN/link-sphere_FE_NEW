import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';
import { IdempotencyKeyUtil } from '@/shared/utils/idempotency-key.util';

const HOUR_MS = 60 * 60 * 1000;

function pendingEntries(): { content: string; key: string }[] {
  return JSON.parse(sessionStorage.getItem(STORAGE_KEYS.IDEMPOTENCY.PENDING) ?? '[]') as {
    content: string;
    key: string;
  }[];
}

// 응답을 못 받고 끝난 요청 - 키가 남아야 한다
async function failedKey(content: string): Promise<string> {
  let captured = '';

  await IdempotencyKeyUtil.send(content, async (key) => {
    captured = key;
    throw new Error('network');
  }).catch(() => undefined);

  return captured;
}

async function succeededKey(content: string): Promise<string> {
  let captured = '';

  await IdempotencyKeyUtil.send(content, async (key) => {
    captured = key;
  });

  return captured;
}

describe('IdempotencyKeyUtil', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('실패 뒤 같은 내용을 다시 보내면 같은 키를 쓴다', async () => {
    const first = await failedKey('post:a');

    expect(first).toMatch(/^[0-9a-f-]{36}$/);
    expect(await failedKey('post:a')).toBe(first);
  });

  it('내용이 다르면 새 키를 쓰고, 고쳤다 되돌리면 처음 키를 쓴다', async () => {
    const original = await failedKey('post:a');
    const edited = await failedKey('post:b');

    expect(edited).not.toBe(original);
    expect(await failedKey('post:a')).toBe(original);
  });

  it('성공하면 그 키를 버려 다음 요청은 새 키를 쓴다', async () => {
    const first = await failedKey('post:a');

    expect(await succeededKey('post:a')).toBe(first);
    expect(pendingEntries()).toEqual([]);
    expect(await succeededKey('post:a')).not.toBe(first);
  });

  it('겹친 요청은 같은 키를 쓴다', async () => {
    const keys: string[] = [];
    const request = async (key: string) => {
      keys.push(key);
    };

    await Promise.all([
      IdempotencyKeyUtil.send('post:a', request),
      IdempotencyKeyUtil.send('post:a', request),
    ]);

    expect(keys[0]).toBe(keys[1]);
  });

  it('성공해도 다른 내용의 키는 남긴다', async () => {
    const other = await failedKey('comment:a');

    await succeededKey('post:a');

    expect(pendingEntries().map((entry) => entry.key)).toEqual([other]);
  });

  it('모듈을 다시 불러와도(새로고침) 같은 키를 쓴다', async () => {
    const first = await failedKey('post:a');

    vi.resetModules();
    const { IdempotencyKeyUtil: reloaded } = await import('@/shared/utils/idempotency-key.util');
    let captured = '';

    await reloaded.send('post:a', async (key) => {
      captured = key;
    });

    expect(captured).toBe(first);
  });

  it('1시간이 지난 키는 재사용하지 않고 저장소에서도 지운다', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const first = await failedKey('post:a');

    await failedKey('post:other');
    vi.setSystemTime(HOUR_MS);

    const next = await failedKey('post:a');

    expect(next).not.toBe(first);
    expect(pendingEntries().map((entry) => entry.content)).toEqual(['post:a']);
  });

  it('21번째를 저장하면 가장 오래된 키를 지운다', async () => {
    for (let index = 0; index < 21; index += 1) {
      await failedKey(`post:${index}`);
    }

    const contents = pendingEntries().map((entry) => entry.content);

    expect(contents).toHaveLength(20);
    expect(contents).not.toContain('post:0');
    expect(contents).toContain('post:20');
  });

  it('clear는 남은 키를 모두 지운다', async () => {
    await failedKey('post:a');

    IdempotencyKeyUtil.clear();

    expect(sessionStorage.getItem(STORAGE_KEYS.IDEMPOTENCY.PENDING)).toBeNull();
  });

  it('저장소를 쓸 수 없어도 요청은 나간다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError');
    });

    expect(await succeededKey('post:a')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
