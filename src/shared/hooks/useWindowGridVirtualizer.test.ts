import { afterEach, describe, expect, it } from 'vitest';
import { Virtualizer } from '@tanstack/react-virtual';
import {
  chunkIntoRows,
  resolveColumnCount,
  shouldAdjustScrollOnItemResize,
} from '@/shared/hooks/useWindowGridVirtualizer';

describe('resolveColumnCount', () => {
  const minColumnWidth = 330;
  const gap = 16;
  const maxColumns = 3;

  it('정확히 3열이 들어맞는 폭이면 3을 반환한다', () => {
    const width = 3 * minColumnWidth + 2 * gap;
    expect(resolveColumnCount(width, minColumnWidth, gap, maxColumns)).toBe(3);
  });

  it('경계보다 1px 좁으면 2를 반환한다', () => {
    const width = 3 * minColumnWidth + 2 * gap - 1;
    expect(resolveColumnCount(width, minColumnWidth, gap, maxColumns)).toBe(2);
  });

  it('maxColumns를 넘는 폭이어도 maxColumns로 clamp한다', () => {
    expect(resolveColumnCount(10000, minColumnWidth, gap, maxColumns)).toBe(maxColumns);
  });

  it('minColumnWidth보다 좁으면 1을 반환한다', () => {
    expect(resolveColumnCount(minColumnWidth - 1, minColumnWidth, gap, maxColumns)).toBe(1);
  });

  it('폭이 0이어도 1을 반환한다(음수·NaN 열 수 방지)', () => {
    expect(resolveColumnCount(0, minColumnWidth, gap, maxColumns)).toBe(1);
  });
});

describe('chunkIntoRows', () => {
  it('열 수로 나누어떨어지면 행마다 열 수만큼 들어간다', () => {
    expect(chunkIntoRows(['a', 'b', 'c', 'd', 'e', 'f'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e', 'f'],
    ]);
  });

  it('나머지가 있으면 마지막 행은 열 수보다 적게 들어간다', () => {
    expect(chunkIntoRows(['a', 'b', 'c', 'd', 'e'], 3)).toEqual([
      ['a', 'b', 'c'],
      ['d', 'e'],
    ]);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(chunkIntoRows([], 3)).toEqual([]);
  });

  it('열 수가 1이면 아이템마다 한 행이 된다', () => {
    expect(chunkIntoRows(['a', 'b'], 1)).toEqual([['a'], ['b']]);
  });

  it('열 수가 0 이하이면 빈 배열을 반환한다(무한 루프 방지)', () => {
    expect(chunkIntoRows(['a', 'b'], 0)).toEqual([]);
  });
});

/**
 * shouldAdjustScrollOnItemResize는 가드를 통과하면 virtual-core 기본 판정을 옮겨 적은 로직을 쓴다.
 * 라이브러리를 올려 원본 판정이 바뀌면 조용히 어긋나므로, 실제 Virtualizer를 띄워 콜백을
 * 지정하지 않은 경우(라이브러리 기본)와 이 함수를 지정한 경우의 스크롤 보정 쓰기를 같은 상황에서
 * 비교한다 — 원본 코드 문자열이 아니라 동작을 비교하므로 포맷·주석 변화에는 깨지지 않고, 판정의
 * 의미가 바뀔 때만 실패한다.
 */
describe('shouldAdjustScrollOnItemResize — virtual-core 기본 판정과의 차등 비교', () => {
  const ITEM_SIZE = 100;
  const COUNT = 50;
  const originalScrollY = Object.getOwnPropertyDescriptor(window, 'scrollY');

  /** 가드는 실제 window.scrollY를 캐시와 비교한다 — 테스트에서 원하는 값으로 고정한다 */
  function setWindowScrollY(value: number) {
    Object.defineProperty(window, 'scrollY', { configurable: true, value });
  }

  afterEach(() => {
    if (originalScrollY) {
      Object.defineProperty(window, 'scrollY', originalScrollY);
    }
  });

  type Adjust = typeof shouldAdjustScrollOnItemResize;

  function createVirtualizer(adjust: Adjust | undefined) {
    const scrollWrites: Array<{ offset: number; adjustments: number | undefined }> = [];
    let emitOffset: (offset: number, isScrolling: boolean) => void = () => {};

    const virtualizer = new Virtualizer<Window, HTMLDivElement>({
      count: COUNT,
      getScrollElement: () => window,
      estimateSize: () => ITEM_SIZE,
      scrollToFn: (offset, { adjustments }) => {
        scrollWrites.push({ offset, adjustments });
      },
      observeElementRect: (_instance, cb) => {
        cb({ width: 800, height: 600 });
      },
      observeElementOffset: (_instance, cb) => {
        emitOffset = cb;
      },
    });

    virtualizer._willUpdate();

    if (adjust) {
      virtualizer.shouldAdjustScrollPositionOnItemSizeChange = adjust;
    }

    return { virtualizer, scrollWrites, emitOffset: (o: number, s: boolean) => emitOffset(o, s) };
  }

  type Direction = 'forward' | 'backward' | 'idle';

  interface Scenario {
    offset: number;
    index: number;
    remeasure: boolean;
    direction: Direction;
  }

  /** 스크롤 위치·방향을 만든 뒤 한 행의 크기를 바꾸고, 그때 일어난 스크롤 쓰기를 돌려준다 */
  function runScenario(adjust: Adjust | undefined, scenario: Scenario) {
    const { virtualizer, scrollWrites, emitOffset } = createVirtualizer(adjust);

    if (scenario.direction === 'idle') {
      emitOffset(scenario.offset, false);
    } else {
      const from = scenario.direction === 'forward' ? scenario.offset - 10 : scenario.offset + 10;
      emitOffset(from, true);
      emitOffset(scenario.offset, true);
    }

    virtualizer.getVirtualItems();

    if (scenario.remeasure) {
      setWindowScrollY(virtualizer.scrollOffset ?? 0);
      virtualizer.resizeItem(scenario.index, ITEM_SIZE + 40);
      virtualizer.getVirtualItems();
    }

    // 가드가 발동하지 않게 실제 스크롤을 캐시와 같게 둔다 — 여기서는 복제한 기본 판정만 본다
    setWindowScrollY(virtualizer.scrollOffset ?? 0);
    scrollWrites.length = 0;
    virtualizer.resizeItem(scenario.index, ITEM_SIZE + (scenario.remeasure ? 80 : 40));

    return scrollWrites;
  }

  // offset 1050 기준: 5번 행은 화면 위쪽 가장자리보다 전부 위(500~600), 10번은 그 가장자리에
  // 걸침(1000~1100), 15번은 가장자리보다 아래(1500~). offset 0: 0번은 맨 위, 5번은 아래.
  const placements: Array<{ offset: number; index: number }> = [
    { offset: 1050, index: 5 },
    { offset: 1050, index: 10 },
    { offset: 1050, index: 15 },
    { offset: 0, index: 0 },
    { offset: 0, index: 5 },
  ];
  const DIRECTION_LABEL: Record<Direction, string> = {
    forward: '아래로 스크롤 중',
    backward: '위로 스크롤 중',
    idle: '정지',
  };
  const scenarios: Array<Scenario & { name: string }> = placements.flatMap((placement) =>
    [false, true].flatMap((remeasure) =>
      (['forward', 'backward', 'idle'] as const).map((direction) => ({
        ...placement,
        remeasure,
        direction,
        name: `스크롤 ${placement.offset}px, ${placement.index}번 행 ${remeasure ? '재측정' : '첫 측정'}, ${DIRECTION_LABEL[direction]}`,
      }))
    )
  );

  it.each(scenarios)('$name — 라이브러리 기본과 같은 보정을 한다', (scenario) => {
    expect(runScenario(shouldAdjustScrollOnItemResize, scenario)).toEqual(
      runScenario(undefined, scenario)
    );
  });

  // 위 행렬은 크기를 바꿀 때마다 측정을 다시 만들어(= 렌더) 이 경우를 못 본다 — 원본은 행 끝을
  // 최신 크기 캐시로 계산하고, 콜백에 넘어오는 item.end는 마지막 측정 재계산 때의 값이다.
  it('같은 행이 다시 그려지기 전에 크기가 두 번 바뀌어도 라이브러리 기본과 같은 보정을 한다', () => {
    const run = (adjust: Adjust | undefined) => {
      const { virtualizer, scrollWrites, emitOffset } = createVirtualizer(adjust);

      emitOffset(1050, false);
      virtualizer.getVirtualItems();

      const steps: Array<{ size: number; rebuild: boolean }> = [
        { size: 140, rebuild: true },
        { size: 40, rebuild: false },
        { size: 60, rebuild: false },
      ];

      for (const { size, rebuild } of steps) {
        setWindowScrollY(virtualizer.scrollOffset ?? 0);
        virtualizer.resizeItem(10, size);

        if (rebuild) {
          virtualizer.getVirtualItems();
        }
      }

      return scrollWrites;
    };

    expect(run(shouldAdjustScrollOnItemResize)).toEqual(run(undefined));
  });

  it('비교가 헛돌지 않는다 — 위 상황들에서 기본 판정이 보정하는 경우와 안 하는 경우가 둘 다 있다', () => {
    const adjusted = scenarios.map((scenario) => runScenario(undefined, scenario).length > 0);

    expect(adjusted).toContain(true);
    expect(adjusted).toContain(false);
  });

  it('가드: 실제 스크롤이 캐시와 한 화면 넘게 벌어지면 기본 판정이 보정할 상황이어도 보정하지 않는다', () => {
    const scenario: Scenario = { offset: 1050, index: 5, remeasure: false, direction: 'idle' };
    const withGuard = createVirtualizer(shouldAdjustScrollOnItemResize);
    const withoutGuard = createVirtualizer(undefined);

    for (const { virtualizer, emitOffset } of [withGuard, withoutGuard]) {
      emitOffset(scenario.offset, false);
      virtualizer.getVirtualItems();
    }

    // ScrollRestoration이 방금 맨 위로 보냈지만 캐시는 아직 옛 위치(1050)인 상황
    setWindowScrollY(0);
    withGuard.scrollWrites.length = 0;
    withoutGuard.scrollWrites.length = 0;
    withGuard.virtualizer.resizeItem(scenario.index, ITEM_SIZE + 40);
    withoutGuard.virtualizer.resizeItem(scenario.index, ITEM_SIZE + 40);

    expect(withoutGuard.scrollWrites).not.toEqual([]);
    expect(withGuard.scrollWrites).toEqual([]);
  });
});
