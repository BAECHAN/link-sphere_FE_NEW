import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ScrollUtil } from '@/shared/utils/scroll.util';
import { useFollowFocusOnReorder } from '@/widgets/bookmark/folder-tree/hooks/useFollowFocusOnReorder';

let container: HTMLDivElement;
let items: HTMLElement[];

// 항목마다 ⋮ 메뉴 트리거 자리의 버튼 하나 — 메뉴가 닫히면 포커스가 여기로 돌아온다
function renderList(initialOrder: string[]) {
  return renderHook(({ order }) => useFollowFocusOnReorder({ current: container }, order), {
    initialProps: { order: initialOrder },
  });
}

beforeEach(() => {
  container = document.createElement('div');
  items = ['a', 'b', 'c'].map(() => {
    const item = document.createElement('div');
    item.appendChild(document.createElement('button'));
    item.scrollIntoView = vi.fn();
    container.appendChild(item);
    return item;
  });
  document.body.appendChild(container);
});

afterEach(() => {
  container.remove();
});

describe('useFollowFocusOnReorder', () => {
  it('순서가 바뀌면 포커스가 든 항목으로 스크롤한다', () => {
    const { rerender } = renderList(['a', 'b', 'c']);
    items[2]?.querySelector('button')?.focus();

    rerender({ order: ['c', 'a', 'b'] });

    expect(items[2]?.scrollIntoView).toHaveBeenCalledWith({
      block: 'nearest',
      behavior: ScrollUtil.getBehavior(),
    });
    expect(items[0]?.scrollIntoView).not.toHaveBeenCalled();
  });

  it('순서가 그대로면(이름·개수만 바뀐 리렌더) 스크롤하지 않는다', () => {
    const { rerender } = renderList(['a', 'b', 'c']);
    items[2]?.querySelector('button')?.focus();

    rerender({ order: ['a', 'b', 'c'] });

    expect(items[2]?.scrollIntoView).not.toHaveBeenCalled();
  });

  it('포커스가 목록 밖에 있으면(최근 구획에서 고정 등) 스크롤하지 않는다', () => {
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    const { rerender } = renderList(['a', 'b', 'c']);
    outside.focus();

    rerender({ order: ['c', 'a', 'b'] });

    for (const item of items) {
      expect(item.scrollIntoView).not.toHaveBeenCalled();
    }
    outside.remove();
  });
});
