import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { useAvailabilityCheck } from '@/features/auth/signup/hooks/useAvailabilityCheck';

const schema = z.string().email();

interface Props {
  value: string;
  checkFn: (value: string) => Promise<boolean>;
}

function setup(initial: Props) {
  return renderHook(
    ({ value, checkFn }: Props) => useAvailabilityCheck({ value, schema, checkFn }),
    { initialProps: initial }
  );
}

async function settle(ms = 500) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

function deferred() {
  let resolve!: (v: boolean) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<boolean>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe('useAvailabilityCheck', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('빈 값이나 형식이 틀린 값은 조회하지 않고 idle로 둔다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { result, rerender } = setup({ value: '', checkFn });

    await settle();
    expect(result.current.status).toBe('idle');

    rerender({ value: 'not-an-email', checkFn });
    await settle();

    expect(result.current.status).toBe('idle');
    expect(result.current.isChecking).toBe(false);
    expect(checkFn).not.toHaveBeenCalled();
  });

  it('유효한 값은 확인 중을 거쳐 사용 가능으로 바뀐다', async () => {
    const d = deferred();
    const checkFn = vi.fn().mockReturnValue(d.promise);
    const { result } = setup({ value: 'a@b.com', checkFn });

    expect(result.current.status).toBe('checking');
    expect(result.current.isChecking).toBe(true);

    await act(async () => {
      d.resolve(true);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('available');
    expect(result.current.isAvailable).toBe(true);
    expect(result.current.isDuplicate).toBe(false);
    expect(result.current.isChecking).toBe(false);
  });

  it('서버가 이미 사용 중이라고 답하면 중복으로 표시한다', async () => {
    const checkFn = vi.fn().mockResolvedValue(false);
    const { result } = setup({ value: 'a@b.com', checkFn });

    await settle(0);

    expect(result.current.status).toBe('duplicate');
    expect(result.current.isDuplicate).toBe(true);
    expect(result.current.isAvailable).toBe(false);
  });

  it('앞뒤 공백을 제거한 값으로 조회한다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { result } = setup({ value: '  a@b.com  ', checkFn });

    await settle(0);

    expect(checkFn).toHaveBeenCalledWith('a@b.com');
    expect(result.current.status).toBe('available');
  });

  it('공백만 있는 값은 조회하지 않는다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { result } = setup({ value: '   ', checkFn });

    await settle();

    expect(result.current.status).toBe('idle');
    expect(checkFn).not.toHaveBeenCalled();
  });

  it('입력이 디바운스를 따라잡기 전에는 hasDebounceSettled가 false다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { result, rerender } = setup({ value: 'a@b.com', checkFn });

    expect(result.current.hasDebounceSettled).toBe(true);

    rerender({ value: 'c@d.com', checkFn });
    expect(result.current.hasDebounceSettled).toBe(false);

    await settle();
    expect(result.current.hasDebounceSettled).toBe(true);
  });

  it('입력 중에는 이전 값으로 조회하지 않고 디바운스 후 새 값만 조회한다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { rerender } = setup({ value: 'a@b.com', checkFn });

    await settle(0);
    checkFn.mockClear();

    rerender({ value: 'c@d.com', checkFn });
    await settle(499);
    expect(checkFn).not.toHaveBeenCalled();

    await settle(1);
    expect(checkFn).toHaveBeenCalledTimes(1);
    expect(checkFn).toHaveBeenCalledWith('c@d.com');
  });

  it('같은 값을 이미 확인했다면 공백만 달라지거나 checkFn이 바뀌어도 다시 조회하지 않는다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { result, rerender } = setup({ value: 'a@b.com', checkFn });

    await settle(0);
    expect(checkFn).toHaveBeenCalledTimes(1);

    const another = vi.fn().mockResolvedValue(false);
    rerender({ value: ' a@b.com ', checkFn: another });
    await settle();

    expect(another).not.toHaveBeenCalled();
    expect(checkFn).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('available');
  });

  it('조회 도중 값이 바뀌면 낡은 응답은 버린다', async () => {
    const first = deferred();
    const second = deferred();
    const checkFn = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result, rerender } = setup({ value: 'a@b.com', checkFn });

    rerender({ value: 'c@d.com', checkFn });
    await settle();
    expect(result.current.status).toBe('checking');

    await act(async () => {
      first.resolve(false);
      await Promise.resolve();
    });
    expect(result.current.status).toBe('checking');

    await act(async () => {
      second.resolve(true);
      await Promise.resolve();
    });
    expect(result.current.status).toBe('available');
  });

  it('새 값의 결과가 먼저 도착한 뒤 낡은 응답이 늦게 와도 새 값의 결과를 덮어쓰지 않는다', async () => {
    const first = deferred();
    const checkFn = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(true);
    const { result, rerender } = setup({ value: 'a@b.com', checkFn });

    rerender({ value: 'c@d.com', checkFn });
    await settle();
    expect(result.current.status).toBe('available');

    await act(async () => {
      first.resolve(false);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('available');
    expect(result.current.isDuplicate).toBe(false);
  });

  it('낡은 조회가 실패해도 새 값의 상태를 덮어쓰지 않는다', async () => {
    const first = deferred();
    const checkFn = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValueOnce(false);
    const { result, rerender } = setup({ value: 'a@b.com', checkFn });

    rerender({ value: 'c@d.com', checkFn });
    await settle();
    expect(result.current.status).toBe('duplicate');

    await act(async () => {
      first.reject(new Error('network'));
      await Promise.resolve();
    });

    expect(result.current.status).toBe('duplicate');
  });

  it('조회가 실패하면 확인됐다고 속이지 않고 idle로 둔다', async () => {
    const checkFn = vi.fn().mockRejectedValue(new Error('network'));
    const { result } = setup({ value: 'a@b.com', checkFn });

    await settle(0);

    expect(result.current.status).toBe('idle');
    expect(result.current.isAvailable).toBe(false);
    expect(result.current.isDuplicate).toBe(false);
    expect(result.current.isChecking).toBe(false);
  });

  it('조회가 실패한 값은 다시 입력하면 재조회한다', async () => {
    const checkFn = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue(true);
    const { result, rerender } = setup({ value: 'a@b.com', checkFn });

    await settle(0);
    expect(result.current.status).toBe('idle');

    rerender({ value: 'c@d.com', checkFn });
    await settle();
    rerender({ value: 'a@b.com', checkFn });
    await settle();

    expect(checkFn).toHaveBeenLastCalledWith('a@b.com');
    expect(result.current.status).toBe('available');
  });

  it('형식이 틀려지면 이전 결과를 버리고, 같은 값으로 돌아오면 다시 조회한다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { result, rerender } = setup({ value: 'a@b.com', checkFn });

    await settle(0);
    expect(result.current.status).toBe('available');

    rerender({ value: 'a@b', checkFn });
    await settle();
    expect(result.current.status).toBe('idle');

    const d = deferred();
    checkFn.mockReturnValueOnce(d.promise);
    rerender({ value: 'a@b.com', checkFn });
    await settle();

    expect(result.current.status).toBe('checking');
    expect(checkFn).toHaveBeenCalledTimes(2);
  });

  it('제출에서 중복으로 거절된 값은 markDuplicate로 앞뒤 공백을 빼고 중복 상태가 된다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { result } = setup({ value: 'x@y.com', checkFn });

    await settle(0);
    expect(result.current.status).toBe('available');

    act(() => {
      result.current.markDuplicate('  x@y.com ');
    });

    expect(result.current.status).toBe('duplicate');
    expect(result.current.isDuplicate).toBe(true);
  });

  it('markDuplicate한 값은 디바운스가 따라오기 전에는 확인 중으로 보이고, 따라온 뒤에도 다시 조회하지 않는다', async () => {
    const checkFn = vi.fn().mockResolvedValue(true);
    const { result, rerender } = setup({ value: 'a@b.com', checkFn });

    await settle(0);

    rerender({ value: 'c@d.com', checkFn });
    act(() => {
      result.current.markDuplicate('c@d.com');
    });
    expect(result.current.status).toBe('checking');

    await settle();
    expect(result.current.status).toBe('duplicate');
    expect(checkFn).toHaveBeenCalledTimes(1);
  });
});
