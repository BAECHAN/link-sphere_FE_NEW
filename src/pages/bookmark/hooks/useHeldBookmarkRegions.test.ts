import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHeldBookmarkRegions } from '@/pages/bookmark/hooks/useHeldBookmarkRegions';

// 화면 상태 세 가지 - 넓은 화면, 좁은 화면의 폴더 목록(폴더를 안 고름), 좁은 화면의 글 화면(폴더를 고름)
const WIDE = { isMobile: false, isMobileListMode: false };
const NARROW_LIST = { isMobile: true, isMobileListMode: true };
const NARROW_POSTS = { isMobile: true, isMobileListMode: false };

const SHOWN = { render: true, hidden: false };
const HELD = { render: true, hidden: true };
const NONE = { render: false, hidden: false };

function renderRegions(initial: typeof WIDE) {
  return renderHook((layout: typeof WIDE) => useHeldBookmarkRegions(layout), {
    initialProps: initial,
  });
}

describe('useHeldBookmarkRegions — 경계를 넘지 않으면 보이는 구역만 그린다', () => {
  it.each([
    {
      label: '넓은 화면',
      layout: WIDE,
      expected: { sidebar: SHOWN, folderList: NONE, posts: SHOWN },
    },
    {
      label: '좁은 화면의 폴더 목록',
      layout: NARROW_LIST,
      expected: { sidebar: NONE, folderList: SHOWN, posts: NONE },
    },
    {
      label: '좁은 화면의 글 화면',
      layout: NARROW_POSTS,
      expected: { sidebar: NONE, folderList: NONE, posts: SHOWN },
    },
  ])('$label', ({ layout, expected }) => {
    const { result } = renderRegions(layout);

    expect(result.current).toEqual(expected);
  });

  it('좁은 화면에서 폴더를 드나들어도 숨긴 채 남는 구역이 없다', () => {
    const { result, rerender } = renderRegions(NARROW_LIST);

    rerender(NARROW_POSTS);
    expect(result.current).toEqual({ sidebar: NONE, folderList: NONE, posts: SHOWN });

    rerender(NARROW_LIST);
    expect(result.current).toEqual({ sidebar: NONE, folderList: SHOWN, posts: NONE });
  });
});

describe('useHeldBookmarkRegions — 경계를 넘는 순간 보이던 구역을 숨긴 채 남긴다', () => {
  it('폴더를 안 고른 넓은 화면을 좁히면 사이드바와 글 화면을 숨긴 채 남긴다', () => {
    const { result, rerender } = renderRegions(WIDE);

    rerender(NARROW_LIST);

    expect(result.current).toEqual({ sidebar: HELD, folderList: SHOWN, posts: HELD });
  });

  it('폴더를 고른 넓은 화면을 좁히면 사이드바만 숨긴 채 남긴다', () => {
    const { result, rerender } = renderRegions(WIDE);

    rerender(NARROW_POSTS);

    expect(result.current).toEqual({ sidebar: HELD, folderList: NONE, posts: SHOWN });
  });

  it('좁은 화면의 폴더 목록을 넓히면 폴더 목록을 숨긴 채 남긴다', () => {
    const { result, rerender } = renderRegions(NARROW_LIST);

    rerender(WIDE);

    expect(result.current).toEqual({ sidebar: SHOWN, folderList: HELD, posts: SHOWN });
  });

  it('좁은 화면의 글 화면을 넓히면 숨긴 채 남길 구역이 없다', () => {
    const { result, rerender } = renderRegions(NARROW_POSTS);

    rerender(WIDE);

    expect(result.current).toEqual({ sidebar: SHOWN, folderList: NONE, posts: SHOWN });
  });

  it('좁혔다 다시 넓히면 숨겼던 구역이 보이고, 좁은 화면의 폴더 목록을 숨긴 채 남긴다', () => {
    const { result, rerender } = renderRegions(WIDE);

    rerender(NARROW_LIST);
    rerender(WIDE);

    expect(result.current).toEqual({ sidebar: SHOWN, folderList: HELD, posts: SHOWN });
  });
});

describe('useHeldBookmarkRegions — 숨긴 구역이 평소대로 보이게 되면 평소 규칙으로 돌아간다', () => {
  it('좁힌 뒤 폴더를 고르면 글 화면이 보이고, 사이드바는 계속 숨긴 채 남는다', () => {
    const { result, rerender } = renderRegions(WIDE);

    rerender(NARROW_LIST);
    rerender(NARROW_POSTS);

    expect(result.current).toEqual({ sidebar: HELD, folderList: NONE, posts: SHOWN });
  });

  it('그 뒤 폴더 목록으로 돌아가면 글 화면은 평소처럼 내린다', () => {
    const { result, rerender } = renderRegions(WIDE);

    rerender(NARROW_LIST);
    rerender(NARROW_POSTS);
    rerender(NARROW_LIST);

    expect(result.current).toEqual({ sidebar: HELD, folderList: SHOWN, posts: NONE });
  });
});
