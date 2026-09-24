import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOpenClickGuard } from '@/shared/hooks/useOpenClickGuard';

describe('useOpenClickGuard', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('닫힌 상태는 가드하지 않는다', () => {
    const { result } = renderHook(() => useOpenClickGuard(false, 400));

    expect(result.current()).toBe(false);
  });

  it('열린 직후는 가드한다', () => {
    const { result } = renderHook(() => useOpenClickGuard(true, 400));

    expect(result.current()).toBe(true);
  });

  it('열린 뒤 임계값 이내(200ms)는 계속 가드한다', () => {
    const { result } = renderHook(() => useOpenClickGuard(true, 400));

    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current()).toBe(true);
  });

  it('열린 뒤 임계값(400ms)이 지나면 가드가 풀린다', () => {
    const { result } = renderHook(() => useOpenClickGuard(true, 400));

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current()).toBe(false);
  });

  it('닫았다 다시 열면 가드 시계가 재시작한다', () => {
    const { result, rerender } = renderHook(({ open }) => useOpenClickGuard(open, 400), {
      initialProps: { open: true },
    });

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current()).toBe(false);

    rerender({ open: false });
    rerender({ open: true });

    expect(result.current()).toBe(true);
  });
});
