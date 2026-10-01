import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useAvailabilityMessage } from '@/shared/hooks/useAvailabilityMessage';
import { LOADING_INDICATOR_DELAY_MS } from '@/shared/config/const';

const AVAILABLE = '사용 가능';
const HINT = '안내';
const CHECKING = '확인 중';

type Props = { isChecking: boolean; isAvailable: boolean };

function setup(initial: Props) {
  return renderHook(
    (props: Props) =>
      useAvailabilityMessage({
        ...props,
        checkingText: CHECKING,
        availableText: AVAILABLE,
        hintText: HINT,
      }),
    { initialProps: initial }
  );
}

describe('useAvailabilityMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('평소엔 안내 문구를 기본 톤으로 보여준다', () => {
    const { result } = setup({ isChecking: false, isAvailable: false });

    expect(result.current).toEqual({ description: HINT, descriptionVariant: 'default' });
  });

  it('사용 가능이면 성공 톤 문구를 보여준다', () => {
    const { result } = setup({ isChecking: false, isAvailable: true });

    expect(result.current).toEqual({ description: AVAILABLE, descriptionVariant: 'success' });
  });

  it('사용 가능 뒤 재확인 지연 구간에는 직전 문구를 유지하고, 지연이 지나면 확인 중을 보여준다', () => {
    const { result, rerender } = setup({ isChecking: false, isAvailable: true });

    rerender({ isChecking: true, isAvailable: false });

    expect(result.current).toEqual({ description: AVAILABLE, descriptionVariant: 'success' });

    act(() => {
      vi.advanceTimersByTime(LOADING_INDICATOR_DELAY_MS);
    });

    expect(result.current).toEqual({ description: CHECKING, descriptionVariant: 'default' });
  });

  it('평소 상태에서 확인이 시작되면 지연 구간에 안내 문구를 유지한다', () => {
    const { result, rerender } = setup({ isChecking: false, isAvailable: false });

    rerender({ isChecking: true, isAvailable: false });

    expect(result.current).toEqual({ description: HINT, descriptionVariant: 'default' });
  });

  it('조회가 실패해 사용 가능이 아닌 채 끝나면 안내 문구로 돌아간다', () => {
    const { result, rerender } = setup({ isChecking: false, isAvailable: true });

    rerender({ isChecking: true, isAvailable: false });
    rerender({ isChecking: false, isAvailable: false });

    expect(result.current).toEqual({ description: HINT, descriptionVariant: 'default' });
  });
});
