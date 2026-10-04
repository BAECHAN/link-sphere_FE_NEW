import { act, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { TEXTS } from '@/shared/config/texts';
import { ScrollToCommentFormButton } from '@/widgets/comment/comment-list/ui/ScrollToCommentFormButton';

// setup.ts가 IntersectionObserver를 vi.fn으로 스텁해 둔다 - 컴포넌트가 넘긴 콜백을 꺼내
// "댓글 폼이 화면 밖으로 나감/다시 들어옴"을 직접 알린다.
function reportFormIntersecting(isIntersecting: boolean) {
  const calls = vi.mocked(IntersectionObserver).mock.calls;
  const callback = calls.at(-1)?.[0];

  act(() => {
    callback?.([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  });
}

function renderButton() {
  const targetRef = createRef<HTMLDivElement>();

  return render(
    <>
      <div ref={targetRef}>댓글 폼</div>
      <ScrollToCommentFormButton targetRef={targetRef} />
    </>
  );
}

function queryButton() {
  return screen.queryByRole('button', { name: TEXTS.ariaLabels.scrollToCommentForm });
}

describe('ScrollToCommentFormButton', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('댓글 폼이 화면 안에 있으면 보이지 않는다', () => {
    renderButton();
    reportFormIntersecting(true);

    expect(queryButton()).not.toBeInTheDocument();
  });

  it('댓글 폼이 화면 밖으로 나가면 나타난다', () => {
    renderButton();
    reportFormIntersecting(false);

    expect(queryButton()).toBeInTheDocument();
  });

  it('다시 폼이 보이면 exit 애니메이션(200ms)이 끝날 때까지 남아 있다가 사라진다', () => {
    renderButton();
    reportFormIntersecting(false);
    reportFormIntersecting(true);

    act(() => {
      vi.advanceTimersByTime(199);
    });
    expect(queryButton()).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(queryButton()).not.toBeInTheDocument();
  });

  it('사라지는 도중에 폼이 다시 화면 밖으로 나가면 사라지지 않는다', () => {
    renderButton();
    reportFormIntersecting(false);
    reportFormIntersecting(true);

    act(() => {
      vi.advanceTimersByTime(100);
    });
    reportFormIntersecting(false);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(queryButton()).toBeInTheDocument();
  });
});
