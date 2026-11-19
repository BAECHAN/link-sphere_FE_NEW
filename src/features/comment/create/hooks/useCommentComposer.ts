import { useLayoutEffect, useRef, useState } from 'react';
import { useCreateComment } from '@/features/comment/create/hooks/useCreateComment';
import { useBackClosableOverlay } from '@/shared/hooks/useBackClosableOverlay';
import { useIsMobile } from '@/shared/hooks/useIsMobile';

// BottomTabBar(h-16 + safe-area)와 동일한 기준으로 그 위에 떠 있는다.
const TAB_BAR_RESERVE = 'calc(4rem + env(safe-area-inset-bottom))';
const TOAST_GAP_PX = 8;

type SheetState = 'collapsed' | 'pressed' | 'held';

/**
 * 글 상세 최상위 댓글 작성 칸의 상태. 넓은 화면의 인라인 폼과 좁은 화면의 하단 시트가 이 상태 하나를 같이 쓴다.
 * 폼 상태(글·첨부·실패 안내·이탈 확인 등록)를 폼 화면이 아니라 여기에 둬야, 폭이 768px 경계를 넘어 화면 배치가
 * 바뀌어도 쓰던 글이 남는다(docs/COMMENT.md §5 "작성 칸 하나, 배치 둘").
 */
export function useCommentComposer(postId: string) {
  const isMobile = useIsMobile();
  // 좁은 화면 시트의 펼침. 'pressed'는 접힌 바를 눌러 펼친 것, 'held'는 쓰던 글이 있어 펼쳐 둔 것이다
  const [sheet, setSheet] = useState<SheetState>('collapsed');
  const [prevIsMobile, setPrevIsMobile] = useState(isMobile);

  // 폭이 경계를 넘으면 펼침 기록을 지운다 - 넓은 화면을 거쳐 쓰던 글 없이 다시 좁아지면 접힌 바로 시작한다.
  // effect로 미뤄도 화면 결과는 같았다(2026-11-19 실측). 그래도 렌더 중에 맞춘다 - effect는 낡은 값으로 한 번 그린 뒤
  // 다시 그린다(https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  if (prevIsMobile !== isMobile) {
    setPrevIsMobile(isMobile);
    setSheet('collapsed');
  }

  const draft = useCreateComment({
    postId,
    onSuccess: () => setSheet('collapsed'),
    // 눌러 펼쳤을 때만 입력칸에 포커스를 준다. 폭이 바뀌어 시트가 된 경우에는 옮기지 않는다 - 입력칸에 있던
    // 포커스는 같은 요소라 그대로이고, 없던 포커스를 주면 휴대폰을 돌리기만 해도 키보드가 올라올 수 있다
    autoFocus: sheet === 'pressed',
  });

  // 쓰던 글이 있는데 접혀 있으면 펼쳐 둔다. 폭이 좁아지는 순간에도, 넓은 화면에서 등록한 직후 좁혔다가 실패해 글이
  // 되돌아온 때에도 글이 접힌 바 뒤에 숨지 않는다. 글 유무를 조건에 바로 쓰지 않고 기록으로 남기는 까닭은, 이렇게
  // 펼쳐진 시트가 글을 다 지우거나 등록을 누른 순간에 접히지 않게 하려는 것이다(접히는 때는 취소·등록 성공·폭 경계뿐).
  // 이것은 effect로 미루면 안 된다 - 접힌 화면이 한 번 그려져 입력칸이 새로 만들어지고 포커스가 빠진다(폭이 좁아지는
  // 순간, 응답을 기다리며 글을 쓰던 중 등록이 성공한 순간. 2026-11-19 실측: 미루면 단위 테스트 2건이 실패한다)
  if (isMobile && sheet === 'collapsed' && draft.hasInput) {
    setSheet('held');
  }

  const isSheetOpen = isMobile && sheet !== 'collapsed';

  // 모바일 헤더 검색이 열리면 RecentSearchPanel(z-panel)이 화면을 덮는데 이 바도 같은
  // z층이라 DOM 순서만으로 패널 위에 남는다. 키는 검색창을 여는 쪽(useMobileSearchPanel.ts)과
  // 같아야 한다. 언마운트하지 않고 CSS로만 숨긴다 — 작성 중이던
  // 본문·첨부 이미지와 펼침 상태를 보존해야 한다(이탈 가드가 같은 pathname은 통과시킨다).
  const { isOpen: isMobileSearchOpen } = useBackClosableOverlay('mobileSearchOpen');

  // 좁은 화면에서 화면 아래에 떠 있는 요소(펼친 시트 또는 접힌 바). 둘 중 하나만 그려진다
  const floatingRef = useRef<HTMLDivElement>(null);

  // 이 바가 떠 있는 동안 토스트가 그 위로 뜨도록 --toast-offset-bottom을 바 높이만큼
  // 키운다. 접힘/펼침에 따라 높이가 크게 달라지므로 ResizeObserver로 추적하고,
  // 바가 사라지면(언마운트·넓은 화면) 원래 값(globals.css의 미디어쿼리 값)으로 되돌린다.
  useLayoutEffect(
    function reserveToastSpaceAboveBar() {
      const node = floatingRef.current;

      // 넓은 화면의 인라인 폼은 떠 있지 않아 토스트 자리를 건드리지 않는다
      if (!isMobile || !node) {
        return;
      }

      // 검색 중엔 이 바가 hidden(display:none)이라 offsetHeight가 0이 된다 — 그대로
      // 측정하면 globals.css 기본값(탭바+0.75rem)과 4px 어긋난 값을 덮어쓰게 되므로,
      // 화면에 없는 것과 동일하게 기본값으로 되돌린다.
      if (isMobileSearchOpen) {
        document.documentElement.style.removeProperty('--toast-offset-bottom');
        return;
      }

      function updateToastOffset() {
        const reserve = isSheetOpen ? '0px' : TAB_BAR_RESERVE;
        document.documentElement.style.setProperty(
          '--toast-offset-bottom',
          `calc(${reserve} + ${node!.offsetHeight + TOAST_GAP_PX}px)`
        );
      }

      updateToastOffset();

      const observer = new ResizeObserver(updateToastOffset);
      observer.observe(node);

      return () => {
        observer.disconnect();
        document.documentElement.style.removeProperty('--toast-offset-bottom');
      };
    },
    [isMobile, isSheetOpen, isMobileSearchOpen]
  );

  return {
    draft,
    isMobile,
    isSheetOpen,
    isMobileSearchOpen,
    floatingRef,
    expand: () => setSheet('pressed'),
  };
}
