import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDelayedLoading } from '@/shared/hooks/useDelayedLoading';

describe('useDelayedLoading', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delay 이전에는 false를 반환한다', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 300));

    expect(result.current).toBe(false);
  });

  it('delay가 지나면 true로 바뀐다 (경계값)', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 300));

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });

  it('delay가 지나기 전에 isLoading이 false가 되면 타이머가 취소되어 계속 false다', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading, 300), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ isLoading: false });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe(false);
  });

  it('true가 된 뒤 isLoading이 false가 되면 즉시(타이머 없이) false로 돌아간다', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading, 300), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe(true);

    rerender({ isLoading: false });
    expect(result.current).toBe(false);
  });

  it('delay=0이어도 setTimeout 매크로태스크를 거친 뒤에만 true가 된다', () => {
    const { result } = renderHook(() => useDelayedLoading(true, 0));

    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(result.current).toBe(true);
  });

  it('연속으로 토글해도 마지막 상태만 반영되고 이전 타이머는 새지 않는다', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useDelayedLoading(isLoading, 300), {
      initialProps: { isLoading: true },
    });

    rerender({ isLoading: false });
    rerender({ isLoading: true });
    rerender({ isLoading: false });
    rerender({ isLoading: true });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(true);
  });
});
