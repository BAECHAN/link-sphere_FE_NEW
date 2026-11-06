import { RefObject, useEffect, useRef } from 'react';
import { ScrollUtil } from '@/shared/utils/scroll.util';

/**
 * 폴더 순서가 바뀌었을 때(고정·해제) 포커스가 든 항목이 옮겨 갔으면 화면이 그 항목으로 부드럽게 따라간다
 * (docs/BOOKMARK.md §5). 컨테이너의 직계 자식 하나가 항목 하나여야 한다.
 *
 * 컨테이너에 `[overflow-anchor:none]`을 함께 붙인다 — 없으면 브라우저의 스크롤 고정(scroll anchoring)이 포커스
 * 항목을 먼저 한 프레임 만에 따라가 점프로 보인다(직접 측정, docs/BOOKMARK.md §10).
 * 화면을 그리기 전에 끝낼 일이 아니라 useEffect로 둔다(https://react.dev/reference/react/useLayoutEffect).
 */
export function useFollowFocusOnReorder(
  containerRef: RefObject<HTMLElement | null>,
  order: string[]
) {
  const orderKey = order.join(',');
  const orderKeyRef = useRef(orderKey);

  useEffect(() => {
    if (orderKey === orderKeyRef.current) {
      return;
    }

    orderKeyRef.current = orderKey;
    const focusedItem = Array.from(containerRef.current?.children ?? []).find((item) =>
      item.contains(document.activeElement)
    );
    focusedItem?.scrollIntoView({ block: 'nearest', behavior: ScrollUtil.getBehavior() });
  }, [containerRef, orderKey]);
}
