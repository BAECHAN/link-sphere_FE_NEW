import { Suspense } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DelayedFallback } from '@/shared/ui/elements/DelayedFallback';

/** Suspense 테스트용 - resolve를 밖에서 트리거할 수 있는 리소스 */
function createResource<T>() {
  let status: 'pending' | 'success' = 'pending';
  let result: T;
  let resolveFn: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    resolveFn = resolve;
  }).then((value) => {
    status = 'success';
    result = value;
  });

  return {
    read(): T {
      if (status === 'pending') {
        throw promise;
      }
      return result;
    },
    resolve(value: T) {
      resolveFn(value);
      return promise;
    },
  };
}

function SuspendingChild({ resource }: { resource: ReturnType<typeof createResource<string>> }) {
  const value = resource.read();
  return <div data-testid="resolved-child">{value}</div>;
}

describe('DelayedFallback', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('delay 이전에는 children을 렌더하지 않는다', () => {
    render(
      <DelayedFallback delay={300}>
        <div data-testid="child" />
      </DelayedFallback>
    );

    expect(screen.queryByTestId('child')).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('Suspense 안에서 지연 만료 전에 자식이 resolve되면 fallback이 DOM에 한 번도 나타나지 않는다', async () => {
    const resource = createResource<string>();

    render(
      <Suspense
        fallback={
          <DelayedFallback delay={300}>
            <div data-testid="fallback">loading</div>
          </DelayedFallback>
        }
      >
        <SuspendingChild resource={resource} />
      </Suspense>
    );

    // 지연 만료 전(200ms) 응답이 도착한다
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();

    await act(async () => {
      await resource.resolve('done');
    });

    expect(screen.getByTestId('resolved-child')).toBeInTheDocument();

    // resolve 이후 남은 지연 시간이 흘러도 fallback은 나타나지 않는다 (이미 언마운트됨)
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(screen.queryByTestId('fallback')).not.toBeInTheDocument();
  });
});
