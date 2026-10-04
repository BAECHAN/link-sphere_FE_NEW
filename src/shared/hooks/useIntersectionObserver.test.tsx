import { act, render } from '@testing-library/react';
import { useIntersectionObserver } from '@/shared/hooks/useIntersectionObserver';

function Sentinel({ onIntersect }: { onIntersect: () => void }) {
  const ref = useIntersectionObserver({ onIntersect });
  return <div ref={ref} />;
}

// setup.ts가 IntersectionObserver를 vi.fn으로 스텁해 둔다 - 훅이 넘긴 콜백을 꺼내 교차를 알린다
function reportIntersecting() {
  const callback = vi.mocked(IntersectionObserver).mock.calls.at(-1)?.[0];

  act(() => {
    callback?.([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

describe('useIntersectionObserver', () => {
  beforeEach(() => {
    vi.mocked(IntersectionObserver).mockClear();
  });

  it('보이면 onIntersect를 부른다', () => {
    const onIntersect = vi.fn();
    render(<Sentinel onIntersect={onIntersect} />);

    reportIntersecting();

    expect(onIntersect).toHaveBeenCalledTimes(1);
  });

  it('onIntersect가 새 함수로 바뀌어도 observer를 다시 만들지 않고 최신 함수를 부른다', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Sentinel onIntersect={first} />);

    rerender(<Sentinel onIntersect={second} />);
    reportIntersecting();

    expect(vi.mocked(IntersectionObserver)).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
