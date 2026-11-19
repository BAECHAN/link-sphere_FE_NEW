import { useState } from 'react';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

interface UseFolderNavHiddenGuardParams {
  /** 이 목록이 보이는 폭 - 사이드바(FolderSidebar)는 넓은 화면, 폴더 카드(MobileFolderList)는 좁은 화면 */
  shownOn: 'wide' | 'narrow';
  /** 이름 바꾸기 입력에서 포커스가 빠질 때의 저장(useFolderActions의 submitRename) */
  submitRename: () => void;
}

/**
 * 창 폭이 768px 경계를 넘어 BookmarkPage가 이 목록을 숨긴 채 남길 때(useHeldBookmarkRegions) 생기는 일을 막는다.
 * - 열린 ⋮ 메뉴를 닫는다. 그대로 두면 메뉴를 연 버튼만 숨고 메뉴는 화면 왼쪽 위에 떠 남았다
 * - 숨어서 이름 바꾸기 입력의 포커스가 빠진 것은 저장하지 않는다. 쓰던 이름은 입력에 남아 원래 폭으로 돌아오면 보인다
 * (docs/BOOKMARK.md §5 "폭이 바뀌어도 입력이 남는다")
 */
export function useFolderNavHiddenGuard({ shownOn, submitRename }: UseFolderNavHiddenGuardParams) {
  const isMobile = useIsMobile();
  const isHidden = shownOn === 'wide' ? isMobile : !isMobile;
  const [menuOpen, setMenuOpen] = useState(false);
  const [prevIsHidden, setPrevIsHidden] = useState(isHidden);

  // 숨는 렌더에서 닫는다 - 메뉴가 숨은 버튼에 붙은 채 한 번이라도 그려지지 않게 한다
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (prevIsHidden !== isHidden) {
    setPrevIsHidden(isHidden);

    if (isHidden) {
      setMenuOpen(false);
    }
  }

  // 숨은 입력에는 포커스가 갈 수 없어, 숨은 동안 오는 blur는 숨으면서 빠진 것뿐이다
  const handleRenameBlur = () => {
    if (isHidden) {
      return;
    }

    submitRename();
  };

  return { menuOpen, setMenuOpen, handleRenameBlur };
}
