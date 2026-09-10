import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';

describe('useMinimumLoading', () => {
  beforeEach(() => {
    // useMinimumLoading이 Date.now()로 경과 시간을 계산하므로 Date도 fake에 포함해야 한다.
    // 빼먹으면 elapsedTime이 실시간을 읽어 아래 케이스들이 조용히 무의미해진다.
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('최소 시간 전에 로딩이 끝나면 남은 시간만큼 true를 유지한다', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useMinimumLoading(isLoading, 400), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ isLoading: false });

    // 400ms 중 100ms만 지났으므로 아직 유지돼야 한다
    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(false);
  });

  it('최소 시간이 이미 지난 뒤 로딩이 끝나면 즉시 false가 된다', () => {
    const { result, rerender } = renderHook(({ isLoading }) => useMinimumLoading(isLoading, 400), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(500);
    });
    rerender({ isLoading: false });

    expect(result.current).toBe(false);
  });

  it('isError가 true가 되면 최소 시간과 무관하게 즉시 종료한다', () => {
    const { result, rerender } = renderHook(
      ({ isLoading, isError }) => useMinimumLoading(isLoading, 1000, isError),
      { initialProps: { isLoading: true, isError: false } }
    );

    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ isLoading: true, isError: true });

    expect(result.current).toBe(false);
  });

  it('언마운트 시 타이머를 정리한다', () => {
    const { rerender, unmount } = renderHook(({ isLoading }) => useMinimumLoading(isLoading, 400), {
      initialProps: { isLoading: true },
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({ isLoading: false });
    unmount();

    // 언마운트 후 남은 타이머가 실행되어도 예외가 발생하지 않아야 한다
    expect(() => {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }).not.toThrow();
  });
});
