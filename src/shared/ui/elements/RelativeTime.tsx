import { useEffect, useState } from 'react';
import dayjs from 'dayjs';

/** 글자를 다시 계산하는 주기 - 상대 시간의 가장 작은 단위가 분이다 */
const TICK_INTERVAL_MS = 60 * 1000;

type NowListener = (now: number) => void;

// 화면의 모든 RelativeTime이 타이머 하나를 함께 쓴다. 구독자가 없으면 타이머와 이벤트 리스너도 없다
const listeners = new Set<NowListener>();
let timerId: ReturnType<typeof setInterval> | null = null;

function readNow() {
  return dayjs().valueOf();
}

function notify() {
  const now = readNow();

  listeners.forEach((listener) => listener(now));
}

function stopTimer() {
  if (timerId === null) {
    return;
  }

  clearInterval(timerId);
  timerId = null;
}

function restartTimer() {
  stopTimer();
  timerId = setInterval(notify, TICK_INTERVAL_MS);
}

/**
 * 돌아온 순간 - 멈춰 있던 글자를 바로 맞추고 주기를 처음부터 다시 센다.
 * 탭이 다시 보일 때(visibilitychange)뿐 아니라 창 포커스·pageshow에도 부른다 - 절전에서 깨어났을 때처럼
 * visibilitychange 없이 시계만 건너뛰는 경우를 줄인다(같은 세 이벤트를 듣는 선례: useAppVersionCheck.ts).
 */
function handleReturn() {
  if (document.visibilityState === 'hidden') {
    return;
  }

  notify();
  restartTimer();
}

function handleVisibilityChange() {
  // 안 보이는 글자는 다시 그리지 않는다 - 다시 보일 때 handleReturn이 바로 맞춘다
  if (document.visibilityState === 'hidden') {
    stopTimer();

    return;
  }

  handleReturn();
}

function subscribe(listener: NowListener) {
  listeners.add(listener);

  if (listeners.size === 1) {
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleReturn);
    window.addEventListener('pageshow', handleReturn);

    if (document.visibilityState !== 'hidden') {
      restartTimer();
    }
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size > 0) {
      return;
    }

    stopTimer();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    window.removeEventListener('focus', handleReturn);
    window.removeEventListener('pageshow', handleReturn);
  };
}

export interface RelativeTimeProps<TDate> {
  /** 기준이 되는 시각(작성 시각 등) - 타입을 정하지 않고 그대로 format에 넘긴다 */
  date: TDate;
  /** 글자를 만드는 함수 - 문구는 쓰는 쪽이 정한다. now는 이 부품이 들고 있는 "지금"(epoch 밀리초)이다 */
  format: (date: TDate, now: number) => string;
  className?: string;
}

/**
 * "방금 전 / 3분 전"처럼 시간이 지나면 바뀌어야 하는 글자. 탭을 열어 둔 채 시간이 지나도 새로고침 없이 따라
 * 바뀐다 - 1분마다, 그리고 탭·창으로 돌아온 순간 이 글자만 다시 그린다(카드 전체는 다시 그리지 않는다).
 *
 * "지금"을 state로 들고 format에 넘긴다. 렌더가 시계를 직접 읽으면 다시 그릴 계기가 없어 글자가 멈춘다
 * (https://react.dev/reference/rules/components-and-hooks-must-be-pure).
 * 구독은 useSyncExternalStore가 아니라 useState + useEffect로 한다 - 외부 스토어 변경은 동기 갱신이라, 목록이
 * 전환(transition)으로 바뀌는 중에 틱이 오면 스켈레톤이 번쩍일 수 있다(같은 판단: usePostList.ts의
 * usePostListApplying).
 *
 * role은 주지 않는다 - 1분마다 바뀌는 글을 화면 읽기 프로그램이 매번 읽지 않게 한다.
 *
 * @example
 * ```tsx
 * <RelativeTime
 *   date={post.createdAt}
 *   format={(date, now) => DateUtil.formatRelativeShort(date, now)}
 *   className="text-xs shrink-0"
 * />
 * ```
 */
export function RelativeTime<TDate>({ date, format, className }: RelativeTimeProps<TDate>) {
  const [now, setNow] = useState(readNow);

  useEffect(() => subscribe(setNow), []);

  return <span className={className}>{format(date, now)}</span>;
}
