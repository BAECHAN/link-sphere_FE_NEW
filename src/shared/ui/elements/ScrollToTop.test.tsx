import { act, fireEvent, render, screen } from '@testing-library/react';
import { ScrollToTop } from '@/shared/ui/elements/ScrollToTop';

function scrollTo(y: number) {
  act(() => {
    window.scrollY = y;
    fireEvent.scroll(window);
  });
}

describe('ScrollToTop', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.scrollY = 0;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('처음엔 보이지 않는다', () => {
    render(<ScrollToTop />);

    expect(screen.queryByRole('button', { name: 'Scroll to top' })).not.toBeInTheDocument();
  });

  it('300px 넘게 스크롤하면 나타난다', () => {
    render(<ScrollToTop />);

    scrollTo(301);

    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();
  });

  it('다시 위로 올라가면 exit 애니메이션(200ms)이 끝날 때까지 남아 있다가 사라진다', () => {
    render(<ScrollToTop />);
    scrollTo(301);

    scrollTo(0);
    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('button', { name: 'Scroll to top' })).not.toBeInTheDocument();
  });

  it('사라지는 도중에 다시 내려가면 사라지지 않는다', () => {
    render(<ScrollToTop />);
    scrollTo(301);
    scrollTo(0);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    scrollTo(301);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByRole('button', { name: 'Scroll to top' })).toBeInTheDocument();
  });
});
