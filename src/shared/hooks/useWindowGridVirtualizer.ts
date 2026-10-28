import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import { useLocation } from 'react-router-dom';
import {
  measureElement,
  useWindowVirtualizer,
  type VirtualItem,
  type Virtualizer,
} from '@tanstack/react-virtual';
import { loadVirtualSnapshot, saveVirtualSnapshot } from '@/shared/lib/virtual/virtual-snapshot';

export interface GapBreakpoint {
  /** 이 뷰포트 폭(rem) 이상에서 gap을 쓴다 - Tailwind 브레이크포인트와 같은 rem 단위 */
  minWidthRem: number;
  gap: number;
}

/**
 * 카드 그리드 한 종류의 치수 묶음. 목록 위젯은 어떤 카드를 그리는지 모르므로, 카드를
 * 넘기는 쪽(페이지)이 그 카드의 치수도 함께 넘긴다 (docs/FE-ARCHITECTURE.md §26).
 */
export interface CardGridSpec {
  /** 간격만 담당하는 그리드 클래스(gap-*) - rowGap과 정확히 일치해야 한다 */
  className: string;
  minColumnWidth: number;
  maxColumns: number;
  rowGap: readonly GapBreakpoint[];
  /** 열 수별 행 높이 추정치(px) - 실측 전 초기값 */
  rowHeightEstimate: Readonly<Record<number, number>>;
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

function minWidthQuery(minWidthRem: number) {
  return `(width >= ${minWidthRem}rem)`;
}

function resolveByViewport<T extends { minWidthRem: number }>(breakpoints: readonly T[]): T {
  const sorted = [...breakpoints].sort((a, b) => b.minWidthRem - a.minWidthRem);
  // 항상 minWidthRem: 0인 항목이 하나 포함돼 있어(post-card-grid.const.ts 등 호출부 계약) 마지막
  // 원소가 비어있을 일은 없다
  return (
    sorted.find((bp) => window.matchMedia(minWidthQuery(bp.minWidthRem)).matches) ??
    sorted[sorted.length - 1]!
  );
}

/** Tailwind 반응형 클래스(md:, lg: 등)와 같은 rem 조건으로 뷰포트 너비별 값을 추적한다.
 * innerWidth(px)와 비교하지 않는다 - 미디어 쿼리의 rem은 브라우저 기본 글꼴 크기를 따라서,
 * 그 설정을 바꾼 사용자에게서 CSS gap과 갈린다(responsive-ux skill "브레이크포인트").
 * matchMedia 기반 감지는 useIsMobile.ts의 선례를 따른다. gap은 간격일 뿐 열 수에 영향을
 * 주지 않아 뷰포트 기준으로 남겨둔다 - 열 수만 컨테이너 실측 폭 기준(아래 참고).
 * 브라우저 API 구독이라 useSyncExternalStore로 읽는다 - effect 안에서 setState하면 낡은 값으로
 * 한 번 더 렌더된다(https://react.dev/reference/react/useSyncExternalStore#subscribing-to-a-browser-api).
 * resolveByViewport는 breakpoints 배열의 원소 자체를 돌려줘 같은 너비 구간이면 참조가 같다 -
 * getSnapshot이 매번 새 객체를 돌려주면 무한 재렌더가 나므로 이 성질에 기댄다. */
function useResponsiveValue<T extends { minWidthRem: number }>(breakpoints: readonly T[]): T {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const queries = breakpoints.map((bp) => window.matchMedia(minWidthQuery(bp.minWidthRem)));

      queries.forEach((mediaQuery) => {
        if (mediaQuery.addEventListener) {
          mediaQuery.addEventListener('change', onChange);
        } else {
          mediaQuery.addListener(onChange);
        }
      });

      return () => {
        queries.forEach((mediaQuery) => {
          if (mediaQuery.removeEventListener) {
            mediaQuery.removeEventListener('change', onChange);
          } else {
            mediaQuery.removeListener(onChange);
          }
        });
      };
    },
    [breakpoints]
  );

  return useSyncExternalStore(subscribe, () => resolveByViewport(breakpoints));
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
 * 올려 원본 판정이 바뀌면 useWindowGridVirtualizer.test.ts의 차등 테스트(콜백 미지정 =
 * 라이브러리 기본과 이 함수의 스크롤 보정을 같은 상황에서 비교)가 실패한다 - 그때 원본을
 * 다시 옮겨 적는다.
 */
export function shouldAdjustScrollOnItemResize(
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

  // 원본은 행 끝을 item.end(마지막 측정 재계산 때의 값)가 아니라 최신 크기 캐시로 잡는다 — 같은
  // 행이 다시 그려지기 전에 크기가 두 번 바뀌면 둘이 달라진다
  const itemSize = instance.itemSizeCache.get(item.key) ?? item.size;

  return item.start + itemSize <= offset && instance.scrollDirection !== 'backward';
}

/** 화면 위에 붙어 콘텐츠를 가리는 상단바 높이(px) - Navbar.tsx가 실측해 --navbar-height로 게시한다.
 * 그 아래부터가 사용자가 실제로 보는 영역이다. */
function readNavbarHeight(): number {
  return (
    parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--navbar-height')) || 0
  );
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
  // 열 수가 바뀔 때 앵커 행을 화면 꼭대기에서 얼마나 떨어진 곳에 둘지(px). scrollToIndex(align:
  // 'start')가 item.start - scrollPaddingStart로 목표를 잡고 측정이 끝날 때까지 다시 맞추므로
  // (virtual-core 3.17.11 getOffsetForIndex·reconcileScroll) 이 옵션으로 넘긴다. scrollToIndex를
  // 부르는 곳은 아래 앵커 이펙트뿐이라 다른 스크롤에는 영향이 없다.
  const [anchorScrollPadding, setAnchorScrollPadding] = useState(0);

  const rows = useMemo(() => chunkIntoRows(items, columnCount), [items, columnCount]);
  const { containerRef: scrollMarginRef, scrollMargin, remeasureScrollMargin } = useScrollMargin();

  const containerRef = useCallback(
    (node: HTMLDivElement | null) => {
      scrollMarginRef(node);
      setContainerNode(node);
    },
    [scrollMarginRef]
  );

  // 아래 effect·ResizeObserver 콜백이 최신 columnCount/items.length를 읽기 위한 ref. 렌더 중이 아니라
  // 레이아웃 effect에서 갱신한다(https://react.dev/reference/eslint-plugin-react-hooks/lints/refs) -
  // 이 훅의 다른 레이아웃 effect보다 먼저 선언돼 있어 그쪽은 항상 최신 값을 본다.
  const columnCountRef = useRef(columnCount);
  const itemCountRef = useRef(items.length);

  useLayoutEffect(() => {
    columnCountRef.current = columnCount;
    itemCountRef.current = items.length;
  });

  // 열 수가 바뀌면 행이 재청크돼 같은 카드가 다른 행으로 옮겨간다 - 키에 열 수를 접두어로
  // 붙여, 이전 열 수에서 측정한 행 높이를 새 열 수의 행이 잘못 재사용하지 않게 한다.
  // virtual-core가 렌더 중에 이 함수를 부르므로(getVirtualItems) ref가 아니라 의존성으로 최신
  // rows를 잡는다. rows는 items·columnCount가 바뀔 때만 새로 만들어지고 getItemId는 호출부의 모듈
  // 상수라, 측정 위치 재계산도 그때만 일어난다(측정한 행 높이는 키 기준 캐시라 유지된다).
  const getItemKey = useCallback(
    (index: number): string | number => {
      const firstItem = rows[index]?.[0];
      return firstItem ? `${columnCount}:${getItemId(firstItem)}` : index;
    },
    [rows, columnCount, getItemId]
  );

  // 컨테이너 폭이 바뀌면 행 ResizeObserver(virtual-core가 첫 행을 그릴 때 만들어 이 훅의
  // ResizeObserver보다 먼저 돈다)가 열 수를 다시 정하기 전의 행을 새 폭으로 한 번 잰다. 그 높이가
  // 옛 열 수 키로 캐시되면 그 열 수로 돌아올 때 위쪽 행 높이가 틀려, 앵커 행이 제자리에 놓인 뒤
  // 밀린다 - 800px 레일에서 2→1→2열로 오가면 90px(직접 측정). 위로 점프한 직후라 virtual-core가
  // 재측정을 보정하지 않는다(역방향 스크롤, dist/esm/index.js resizeItem). 그래서 렌더된 열 수가
  // 지금 폭의 열 수와 다르면 그 측정은 버리고 캐시 값을 돌려준다(라이브러리 useCachedMeasurements
  // 분기와 같은 형태, dist/esm/index.js:129-133). 옵션은 렌더 중에 갱신되므로(react-virtual 3.14.13
  // dist/esm/index.js:113) 새 열 수로 다시 그린 행은 이 함수의 새 columnCount로 정상 측정된다.
  const measureRow = useCallback(
    (
      element: HTMLDivElement,
      entry: ResizeObserverEntry | undefined,
      instance: Virtualizer<Window, HTMLDivElement>
    ): number => {
      const width = containerNode?.getBoundingClientRect().width ?? 0;

      if (width > 0 && resolveColumnCount(width, minColumnWidth, gap, maxColumns) !== columnCount) {
        const index = instance.indexFromElement(element);
        return (
          instance.itemSizeCache.get(instance.options.getItemKey(index)) ??
          instance.options.estimateSize(index)
        );
      }

      return measureElement(element, entry, instance);
    },
    [containerNode, minColumnWidth, gap, maxColumns, columnCount]
  );

  const virtualizer = useWindowVirtualizer<HTMLDivElement>({
    count: rows.length,
    estimateSize: () => estimateRowHeight(columnCount),
    overscan,
    gap,
    scrollMargin,
    scrollPaddingStart: anchorScrollPadding,
    getItemKey,
    measureElement: measureRow,
    // eslint-disable-next-line no-restricted-properties -- 폭 판정이 아니라 첫 렌더의 창 크기다(virtual-core도 창 크기를 window.innerWidth로 잰다)
    initialRect: { width: window.innerWidth, height: window.innerHeight },
    ...(snapshot
      ? { initialMeasurementsCache: snapshot.items, initialOffset: snapshot.offset }
      : {}),
  });

  // 옵션이 아니라 인스턴스 속성이라(virtual-core Virtualizer.shouldAdjustScrollPositionOnItemSizeChange)
  // 대입할 수밖에 없다. effect로 옮기면 안 된다 - 이 가드가 막는 "라우트 이동 직후 첫 측정"은 행의
  // measureElement ref 콜백에서 일어나는데, 자식 ref는 이 훅의 레이아웃 effect보다 먼저 실행된다
  // eslint-disable-next-line react-hooks/immutability -- 위 이유로 렌더 중에 대입한다
  virtualizer.shouldAdjustScrollPositionOnItemSizeChange = shouldAdjustScrollOnItemResize;

  const virtualizerRef = useRef(virtualizer);

  useLayoutEffect(() => {
    virtualizerRef.current = virtualizer;
  });

  // 컨테이너 실측 폭으로 열 수를 정한다(뷰포트가 아니라) - 사이드바 접기/펴기, 북마크
  // 폴더트리처럼 목록이 실제로 받는 폭이 뷰포트보다 좁아지는 레이아웃을 반영하기 위함.
  // 열 수가 바뀔 때는(사이드바 토글, 태블릿 회전 등) 상단바 아래에 처음 보이는 행의 첫 카드
  // index와 그 행이 상단바에서 떨어진 거리를 저장해뒀다가, 아래 두 번째 이펙트에서 재청크된 새
  // 행을 같은 거리에 다시 놓는다 - 보던 카드가 화면의 같은 높이에 남는다. 브라우저 스크롤
  // 앵커링(CSS Scroll Anchoring)·Android RecyclerView가 지키는 것과 같은 "항목 + px 위치"다
  // (근거: docs/DECISIONS.md 2026-10-28). 브라우저 앵커링은 카드 폭·transform이 바뀌면 꺼져
  // 여기서 직접 한다.
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
        // scrollY 자리는 상단바에 가려져 있다 - 거기서 행을 고르면 사용자가 보던 카드가 아니라
        // 상단바 뒤의 윗줄이 기준이 돼, 2→1열에서 보던 카드가 720px 밀렸다(직접 측정)
        const navbarHeight = readNavbarHeight();
        const viewTop = (virtualizerRef.current.scrollOffset ?? 0) + navbarHeight;
        const topRow = virtualizerRef.current.getVirtualItemForOffset(viewTop);
        // 보이는 영역 꼭대기가 목록 시작보다 위(필터 영역 등)면 앵커를 잡지 않는다. virtual-core
        // 3.17.11의 getVirtualItemForOffset은 첫 행 start(scrollMargin 포함)보다 작은 offset에도 첫
        // 행을 돌려줘(dist/esm/index.js findNearestBinarySearch), 맨 위에서 열 수만 바뀌어도 첫 행을
        // 화면 꼭대기로 끌어올렸다(scrollY 0 → 318 직접 측정). 목록 위 영역의 높이는 열 수와
        // 상관없어 scrollY를 그대로 두면 보던 화면이 유지된다
        if (topRow && viewTop >= topRow.start) {
          anchorItemIndexRef.current = topRow.index * columnCountRef.current;
          // 행이 상단바 아래로 반쯤 올라가 있었으면(topRow.start < viewTop) 그만큼 올라간 채로 둔다
          setAnchorScrollPadding(navbarHeight + topRow.start - viewTop);
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
