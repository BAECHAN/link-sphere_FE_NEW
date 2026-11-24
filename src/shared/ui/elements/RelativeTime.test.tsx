import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import dayjs from 'dayjs';
import { act, render, screen } from '@/test/utils';
import { RelativeTime } from '@/shared/ui/elements/RelativeTime';

const WRITTEN_AT = '2026-11-24T00:00:00.000Z';
const MINUTE_MS = 60 * 1000;

// 문구는 쓰는 쪽이 정한다 - 여기서는 지난 분 수만 글자로 만든다
function formatElapsedMinutes(date: string, now: number) {
  return `${dayjs(now).diff(dayjs(date), 'minute')}m`;
}

function changeVisibility(visibilityState: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(visibilityState);
  document.dispatchEvent(new Event('visibilitychange'));
}

function moveClockTo(minutesAfterWritten: number) {
  vi.setSystemTime(dayjs(WRITTEN_AT).add(minutesAfterWritten, 'minute').valueOf());
}

describe('RelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    moveClockTo(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('1분마다 글자를 다시 계산한다', () => {
    render(<RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />);

    expect(screen.getByText('0m')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(MINUTE_MS);
    });

    expect(screen.getByText('1m')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(4 * MINUTE_MS);
    });

    expect(screen.getByText('5m')).toBeInTheDocument();
  });

  it('탭이 숨겨진 동안에는 타이머를 돌리지 않는다', () => {
    render(<RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />);

    act(() => {
      changeVisibility('hidden');
    });

    expect(vi.getTimerCount()).toBe(0);

    act(() => {
      vi.advanceTimersByTime(5 * MINUTE_MS);
    });

    expect(screen.getByText('0m')).toBeInTheDocument();
  });

  it('탭이 다시 보이면 기다리지 않고 바로 다시 계산하고, 그 뒤로 1분 주기를 이어 간다', () => {
    render(<RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />);

    act(() => {
      changeVisibility('hidden');
    });

    // 타이머는 돌리지 않고 시계만 18시간 뒤로 옮긴다
    moveClockTo(18 * 60);

    act(() => {
      changeVisibility('visible');
    });

    expect(screen.getByText('1080m')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(MINUTE_MS);
    });

    expect(screen.getByText('1081m')).toBeInTheDocument();
  });

  it.each(['focus', 'pageshow'])(
    '창에 %s 이벤트가 오면 다음 주기를 기다리지 않고 다시 계산한다',
    (eventName) => {
      render(<RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />);

      moveClockTo(3);

      act(() => {
        window.dispatchEvent(new Event(eventName));
      });

      expect(screen.getByText('3m')).toBeInTheDocument();
    }
  );

  it('탭이 숨겨진 채 창 이벤트가 와도 타이머를 다시 켜지 않는다', () => {
    render(<RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />);

    act(() => {
      changeVisibility('hidden');
    });

    act(() => {
      window.dispatchEvent(new Event('focus'));
    });

    expect(vi.getTimerCount()).toBe(0);
  });

  it('글자가 여럿이어도 타이머는 하나다', () => {
    render(
      <>
        <RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />
        <RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />
        <RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />
      </>
    );

    expect(vi.getTimerCount()).toBe(1);

    act(() => {
      vi.advanceTimersByTime(MINUTE_MS);
    });

    expect(screen.getAllByText('1m')).toHaveLength(3);
    expect(vi.getTimerCount()).toBe(1);
  });

  it('글자가 모두 사라지면 타이머를 멈추고, 돌아와도 다시 켜지 않는다', () => {
    const { unmount } = render(<RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />);

    expect(vi.getTimerCount()).toBe(1);

    unmount();

    expect(vi.getTimerCount()).toBe(0);

    changeVisibility('visible');
    window.dispatchEvent(new Event('focus'));
    window.dispatchEvent(new Event('pageshow'));

    expect(vi.getTimerCount()).toBe(0);
  });

  it('틱이 와도 글자만 다시 그리고 부모는 다시 그리지 않는다', () => {
    const onParentRender = vi.fn();

    function Parent() {
      onParentRender();

      return (
        <div>
          <RelativeTime date={WRITTEN_AT} format={formatElapsedMinutes} />
        </div>
      );
    }

    render(<Parent />);

    const rendersBeforeTick = onParentRender.mock.calls.length;

    act(() => {
      vi.advanceTimersByTime(MINUTE_MS);
    });

    expect(screen.getByText('1m')).toBeInTheDocument();
    expect(onParentRender.mock.calls.length).toBe(rendersBeforeTick);
  });
});
