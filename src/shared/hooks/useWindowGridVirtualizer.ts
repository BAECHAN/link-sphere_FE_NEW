import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useWindowVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { loadVirtualSnapshot, saveVirtualSnapshot } from '@/shared/lib/virtual/virtual-snapshot';

export interface ColumnBreakpoint {
  minWidth: number;
  count: number;
}

export interface GapBreakpoint {
  minWidth: number;
  gap: number;
}

interface UseWindowGridVirtualizerOptions<T> {
  /** 스냅샷 저장 키에 쓰이는 이 리스트의 식별자 - 리스트마다 고유해야 한다 */
  listId: string;
  items: readonly T[];
  getItemId: (item: T) => string;
  columnBreakpoints: readonly ColumnBreakpoint[];
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
 * matchMedia 기반 감지는 useIsMobile.ts의 선례를 따른다. */
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
  columnBreakpoints,
  gapBreakpoints,
  estimateRowHeight,
  overscan = 2,
}: UseWindowGridVirtualizerOptions<T>): UseWindowGridVirtualizerResult<T> {
  const location = useLocation();
  const columnCount = useResponsiveValue(columnBreakpoints).count;
  const gap = useResponsiveValue(gapBreakpoints).gap;

  const rows = useMemo(() => chunkIntoRows(items, columnCount), [items, columnCount]);
  const { containerRef, scrollMargin, remeasureScrollMargin } = useScrollMargin();

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

  const getItemKey = useCallback((index: number): string | number => {
    const firstItem = rowsRef.current[index]?.[0];
    return firstItem ? getItemIdRef.current(firstItem) : index;
  }, []);

  const [snapshot] = useState(() =>
    loadVirtualSnapshot(listId, location.key, columnCount, items.length)
  );

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

  const virtualizerRef = useRef(virtualizer);
  virtualizerRef.current = virtualizer;

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
