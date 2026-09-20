import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useClickGuard } from '@/shared/hooks/useClickGuard';

describe('useClickGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('첫 호출은 항상 통과시킨다', () => {
    const { result } = renderHook(() => useClickGuard(500));

    expect(result.current()).toBe(true);
  });

  it('임계값 이내의 재호출(무의식적 더블클릭 속도)은 무시한다', () => {
    const { result } = renderHook(() => useClickGuard(500));

    expect(result.current()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current()).toBe(false);
  });

  it('임계값이 지난 뒤의 재호출(의식적으로 인지하고 다시 누른 속도)은 통과시킨다', () => {
    const { result } = renderHook(() => useClickGuard(500));

    expect(result.current()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current()).toBe(true);
  });

  it('무시된 호출은 마지막 통과 시점을 갱신하지 않는다', () => {
    const { result } = renderHook(() => useClickGuard(500));

    expect(result.current()).toBe(true);

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current()).toBe(false);

    // 무시된 호출(200ms 지점)이 기준점을 갱신했다면 400ms 지점은 그로부터 200ms만
    // 지난 것이 되어 여전히 무시돼야 한다. 실제로는 최초 통과 시점(0ms) 기준
    // 400ms이므로 아직 500ms 미만이라 이번에도 무시돼야 한다.
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current()).toBe(false);
  });
});
