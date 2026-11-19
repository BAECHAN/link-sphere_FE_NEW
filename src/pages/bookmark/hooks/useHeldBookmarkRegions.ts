import { useState } from 'react';

type Region = 'sidebar' | 'folderList' | 'posts';

interface RegionDisplay {
  /** 화면에 그리는가(안의 입력 상태가 살아 있다) */
  render: boolean;
  /** 그리되 CSS로 숨기는가 */
  hidden: boolean;
}

interface Layout {
  isMobile: boolean;
  isMobileListMode: boolean;
}

// 폭이 바뀌지 않을 때 보이는 구역 - 넓으면 사이드바와 글 화면, 좁으면 폴더를 골랐는지에 따라 폴더 목록이나 글 화면
function visibleRegions({ isMobile, isMobileListMode }: Layout): Region[] {
  if (!isMobile) {
    return ['sidebar', 'posts'];
  }

  return isMobileListMode ? ['folderList'] : ['posts'];
}

/**
 * 북마크 화면의 세 구역(사이드바·폴더 목록·글 화면)을 그릴지와 숨길지 정한다.
 * 창 폭이 768px 경계를 넘는 순간 보이던 구역 가운데 새 폭에서 안 보이게 된 것은 내리지 않고 숨긴 채 남긴다 - 내리면
 * 그 안에서 쓰던 새 폴더 이름·검색어가 버려진다(docs/BOOKMARK.md §5 "폭이 바뀌어도 입력이 남는다").
 * 숨긴 구역은 다음에 경계를 넘을 때 다시 정하고, 폭이 그대로인 채 평소대로 보이게 되면 그때부터 평소 규칙을 따른다.
 */
export function useHeldBookmarkRegions(layout: Layout): Record<Region, RegionDisplay> {
  const [prevLayout, setPrevLayout] = useState(layout);
  const [held, setHeld] = useState<Region[]>([]);
  const visible = visibleRegions(layout);

  // 경계를 넘는 렌더에서 맞춘다. effect로 미루면 옛 폭의 구역이 내려간 화면을 한 번 그려 그 안의 입력이 버려진다
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (
    prevLayout.isMobile !== layout.isMobile ||
    prevLayout.isMobileListMode !== layout.isMobileListMode
  ) {
    setPrevLayout(layout);

    if (prevLayout.isMobile !== layout.isMobile) {
      setHeld(visibleRegions(prevLayout).filter((region) => !visible.includes(region)));
    } else {
      setHeld((current) => current.filter((region) => !visible.includes(region)));
    }
  }

  const display = (region: Region): RegionDisplay => {
    const isVisible = visible.includes(region);
    const isHeld = held.includes(region);

    return { render: isVisible || isHeld, hidden: !isVisible && isHeld };
  };

  return {
    sidebar: display('sidebar'),
    folderList: display('folderList'),
    posts: display('posts'),
  };
}
