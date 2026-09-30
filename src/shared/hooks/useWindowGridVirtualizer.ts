import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useWindowVirtualizer, type VirtualItem, type Virtualizer } from '@tanstack/react-virtual';
import { loadVirtualSnapshot, saveVirtualSnapshot } from '@/shared/lib/virtual/virtual-snapshot';

export interface GapBreakpoint {
  minWidth: number;
  gap: number;
}

interface UseWindowGridVirtualizerOptions<T> {
  /** 스냅샷 저장 키에 쓰이는 이 리스트의 식별자 - 리스트마다 고유해야 한다 */
  listId: string;
  items: readonly T[];
  getItemId: (item: T) => string;
  /** 이 폭보다 좁아지면 열 하나를 줄인다 - resolveColumnCount 참고 */
  minColumnWidth: number;
  maxColumns: number;
  gapBreakpoints: readonly GapBreakpoint[];
  /** 열 수별 행 높이 추정치(px) - 실측 전 초기값일 뿐, measureElement가 곧 실제 높이로 대체한다 */
  estimateRowHeight: (columnCount: number) => number;
  overscan?: number;
}

interface UseWindowGridVirtualizerResult<T> {
  containerRef: (node: HTMLDivElement | null) => void;
  virtualizer: Virtualizer<Window, HTMLDivElement>;
  rows: T[][];
  columnCount: number;
  /** 컨테이너 위 콘텐츠(검색 안내 문구 등) 높이가 바뀌었을 때 호출부에서 직접 재측정 */
  remeasureScrollMargin: () => void;
}

/** items를 columnCount개씩 묶어 행으로 만든다. 각 행 안쪽은 호출부가 지금과 동일한 CSS
 * Grid로 그린다 - lanes 옵션(메이슨리 배치) 대신 이 방식을 쓰는 이유는 상위 계획 문서 참고. */
export function chunkIntoRows<T>(items: readonly T[], columnCount: number): T[][] {
  if (columnCount <= 0) {
    return [];
  }

  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += columnCount) {
    rows.push(items.slice(i, i + columnCount));
  }

  return rows;
}

/**
 * 컨테이너 실측 폭에서 열 수를 계산한다 - web.dev가 "RAM(Repeat, Auto, MinMax)"이라
 * 부르는 `repeat(auto-fit, minmax(<min>, 1fr))` 그리드 패턴(직접 측정 대신 CSS가 계산하는
 * 방식)과 같은 공식이다(https://web.dev/articles/one-line-layouts). 여기서는 가상 스크롤이
 * JS에서 행을 미리 묶어야 해서(chunkIntoRows) 같은 공식을 JS로 계산한다.
 */
export function resolveColumnCount(
  containerWidth: number,
  minColumnWidth: number,
  gap: number,
  maxColumns: number
): number {
  const count = Math.floor((containerWidth + gap) / (minColumnWidth + gap));
  return Math.min(Math.max(count, 1), maxColumns);
}

function resolveByWidth<T extends { minWidth: number }>(
  breakpoints: readonly T[],
  width: number
): T {
  const sorted = [...breakpoints].sort((a, b) => b.minWidth - a.minWidth);
  // 항상 minWidth: 0인 항목이 하나 포함돼 있어(post-grid.const.ts 등 호출부 계약) 마지막
  // 원소가 비어있을 일은 없다
  return sorted.find((bp) => width >= bp.minWidth) ?? sorted[sorted.length - 1]!;
}

/** Tailwind 반응형 클래스(md:, lg: 등)와 같은 방식으로 뷰포트 너비별 값을 추적한다.
 * matchMedia 기반 감지는 useIsMobile.ts의 선례를 따른다. gap은 간격일 뿐 열 수에 영향을
 * 주지 않아 뷰포트 기준으로 남겨둔다 - 열 수만 컨테이너 실측 폭 기준(아래 참고). */
function useResponsiveValue<T extends { minWidth: number }>(breakpoints: readonly T[]): T {
  const resolve = useCallback(() => resolveByWidth(breakpoints, window.innerWidth), [breakpoints]);
  const [value, setValue] = useState(resolve);

  useEffect(() => {
    setValue(resolve());

    const queries = breakpoints.map((bp) => window.matchMedia(`(min-width: ${bp.minWidth}px)`));
    const handleChange = () => setValue(resolve());

    queries.forEach((mediaQuery) => {
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', handleChange);
      } else {
        mediaQuery.addListener(handleChange);
      }
    });

    return () => {
      queries.forEach((mediaQuery) => {
        if (mediaQuery.removeEventListener) {
          mediaQuery.removeEventListener('change', handleChange);
        } else {
          mediaQuery.removeListener(handleChange);
        }
      });
    };
  }, [breakpoints, resolve]);

  return value;
}

/**
 * 행 높이가 추정치와 달라졌을 때 스크롤을 보정할지 정한다 - virtual-core의 기본 판정에
 * "외부 스크롤 가드" 하나를 더한 것이다.
 *
 * 가드: 라우트 이동으로 <ScrollRestoration/>이 window를 맨 위로 보낸 커밋에서, 새 행의 첫
 * 측정(measureElement ref)이 곧바로 일어난다. virtual-core의 scrollOffset 캐시는 비동기
 * scroll 이벤트로만 갱신돼 아직 옛 위치(예: 1400)를 들고 있고, 그 기준으로 "위쪽 행이
 * 커졌다"고 판단해 window를 1400+Δ로 되돌려 버린다(직접 계측: scrollTo(0,0) 3ms 뒤
 * scrollTo({top:1121}), docs/DECISIONS.md 2026-09-30 "URL이 바뀌면 맨 위로" 항목). 캐시와
 * 실제 스크롤이 한 화면 이상 벌어졌다면 방금 라이브러리가 모르는 외부 스크롤이 있었다는
 * 뜻이라 보정하지 않는다. 사용자 스크롤은 프레임 사이에 한 화면씩 튀지 않으므로 평소 보정은
 * 그대로 동작한다.
 *
 * 기본 판정: 이 콜백을 지정하면 기본 판정을 통째로 대체하므로 그대로 옮겨 적는다 -
 * @tanstack/virtual-core 3.17.11 dist/esm/index.js resizeItem(918-933). 라이브러리를
 * 올릴 때 이 부분이 원본과 같은지 다시 확인한다.
 */
function shouldAdjustScrollOnItemResize(
  item: VirtualItem,
  _delta: number,
  instance: Virtualizer<Window, HTMLDivElement>
): boolean {
  const cachedOffset = instance.scrollOffset ?? 0;

  if (Math.abs(window.scrollY - cachedOffset) > window.innerHeight) {
    return false;
  }

  const offset = cachedOffset + instance.scrollAdjustments;
  const isFirstMeasure = !instance.itemSizeCache.has(item.key);

  if (isFirstMeasure) {
    return item.start < offset;
  }

  return item.end <= offset && instance.scrollDirection !== 'backward';
}

/** 목록 컨테이너의 문서 최상단으로부터의 거리(scrollMargin)를 추적한다. 검색 안내
 * 문구·pull-to-refresh 인디케이터처럼 컨테이너 위 콘텐츠 높이가 바뀔 수 있어, 마운트·
 * 리사이즈 시 자동으로 재측정하고 그 외 시점은 remeasureScrollMargin을 노출해 호출부가
 * 직접 트리거하게 한다(당김 동작 중 매 프레임 재측정하지 않기 위함). */
function useScrollMargin() {
  const containerNodeRef = useRef<HTMLDivElement | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);

  const remeasureScrollMargin = useCallback(() => {
    const node = containerNodeRef.current;
    if (node) {
      setScrollMargin(node.offsetTop);
    }
  }, []);

  const containerRef = useCallback((node: HTMLDivElement | null) => {
    containerNodeRef.current = node;
  }, []);

  useLayoutEffect(() => {
    remeasureScrollMargin();
  }, [remeasureScrollMargin]);

  useEffect(() => {
    window.addEventListener('resize', remeasureScrollMargin);
    return () => window.removeEventListener('resize', remeasureScrollMargin);
  }, [remeasureScrollMargin]);

  return { containerRef, scrollMargin, remeasureScrollMargin };
}

export function useWindowGridVirtualizer<T>({
  listId,
  items,
  getItemId,
  minColumnWidth,
  maxColumns,
  gapBreakpoints,
  estimateRowHeight,
  overscan = 2,
}: UseWindowGridVirtualizerOptions<T>): UseWindowGridVirtualizerResult<T> {
  const location = useLocation();
  const gap = useResponsiveValue(gapBreakpoints).gap;

  // 뒤로가기로 돌아왔을 때 스냅샷의 columnCount로 첫 렌더부터 맞춰야 스냅샷의
  // 측정값·오프셋이 낭비되지 않는다(virtual-core가 첫 getVirtualItems() 호출에서
  // initialOffset·initialMeasurementsCache를 소비한다). 스냅샷이 없으면 1로 시작하고
  // 실제 폭은 아래 레이아웃 이펙트가 paint 전에 동기로 보정한다.
  const [snapshot] = useState(() => loadVirtualSnapshot(listId, location.key, items.length));
  const [columnCount, setColumnCount] = useState(() => snapshot?.columnCount ?? 1);
  const [containerNode, setContainerNode] = useState<HTMLDivElement | null>(null);

  const rows = useMemo(() => chunkIntoRows(items, columnCount), [items, columnCount]);
  const { containerRef: scrollMarginRef, scrollMargin, remeasureScrollMargin } = useScrollMargin();

  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollMarginRef(node);
      setContainerNode(node);
    },
    [scrollMarginRef]
  );

  // 아래 콜백들은 매 렌더 새로 만들어지는 rows/columnCount/items.length를 참조해야 하지만,
  // 참조 자체는 안정적으로 유지해야 virtual-core 내부 캐시가 매 렌더 무효화되지 않는다.
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const getItemIdRef = useRef(getItemId);
  getItemIdRef.current = getItemId;
  const columnCountRef = useRef(columnCount);
  columnCountRef.current = columnCount;
  const itemCountRef = useRef(items.length);
  itemCountRef.current = items.length;

  // 열 수가 바뀌면 행이 재청크돼 같은 카드가 다른 행으로 옮겨간다 - 키에 열 수를 접두어로
  // 붙여, 이전 열 수에서 측정한 행 높이를 새 열 수의 행이 잘못 재사용하지 않게 한다.
  const getItemKey = useCallback((index: number): string | number => {
    const firstItem = rowsRef.current[index]?.[0];
    return firstItem ? `${columnCountRef.current}:${getItemIdRef.current(firstItem)}` : index;
  }, []);

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: rows.length,
    estimateSize: () => estimateRowHeight(columnCount),
    overscan,
    gap,
    scrollMargin,
    getItemKey,
    initialRect: { width: window.innerWidth, height: window.innerHeight },
    ...(snapshot
      ? { initialMeasurementsCache: snapshot.items, initialOffset: snapshot.offset }
      : {}),
  });

  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = shouldAdjustScrollOnItemResize;

  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

  // 컨테이너 실측 폭으로 열 수를 정한다(뷰포트가 아니라) - 사이드바 접기/펴기, 북마크
  // 폴더트리처럼 목록이 실제로 받는 폭이 뷰포트보다 좁아지는 레이아웃을 반영하기 위함.
  // 열 수가 바뀔 때는(사이드바 토글 등) 화면 맨 위 행의 첫 카드 index를 저장해뒀다가,
  // 아래 두 번째 이펙트에서 재청크된 새 행으로 스크롤을 다시 맞춘다.
  const hasMeasuredRef = useRef(false);
  const anchorItemIndexRef = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (!containerNode) {
      return;
    }

    function update() {
      const width = containerNode!.getBoundingClientRect().width;
      // Suspense로 목록이 display:none 등으로 숨겨진 순간에는 0이 잡힌다 - 그 값으로
      // 1열로 재청크되는 걸 막는다.
      if (width <= 0) {
        return;
      }

      const nextColumnCount = resolveColumnCount(width, minColumnWidth, gap, maxColumns);

      if (hasMeasuredRef.current && nextColumnCount !== columnCountRef.current) {
        const topRow = virtualizerRef.current.getVirtualItemForOffset(
          virtualizerRef.current.scrollOffset ?? 0
        );
        if (topRow) {
          anchorItemIndexRef.current = topRow.index * columnCountRef.current;
        }
      }

      hasMeasuredRef.current = true;
      setColumnCount(nextColumnCount);
      remeasureScrollMargin();
    }

    update();

    const observer = new ResizeObserver(update);
    observer.observe(containerNode);

    return () => observer.disconnect();
  }, [containerNode, minColumnWidth, maxColumns, gap, remeasureScrollMargin]);

  useLayoutEffect(() => {
    if (anchorItemIndexRef.current === null) {
      return;
    }

    const targetRowIndex = Math.floor(anchorItemIndexRef.current / columnCount);
    anchorItemIndexRef.current = null;
    virtualizerRef.current.scrollToIndex(targetRowIndex, { align: 'start' });
  }, [columnCount]);

  useEffect(() => {
    const save = () => {
      saveVirtualSnapshot(listId, location.key, {
        offset: virtualizerRef.current.scrollOffset ?? 0,
        columnCount: columnCountRef.current,
        count: itemCountRef.current,
        items: virtualizerRef.current.takeSnapshot(),
      });
    };

    window.addEventListener('pagehide', save);

    return () => {
      save();
      window.removeEventListener('pagehide', save);
    };
  }, [listId, location.key]);

  return { containerRef, virtualizer, rows, columnCount, remeasureScrollMargin };
}
