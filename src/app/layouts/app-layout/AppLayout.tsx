import { ReactNode, useLayoutEffect, useRef } from 'react';
import { useMatch } from 'react-router-dom';

import { TEXTS } from '@/shared/config/texts';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { cn } from '@/shared/lib/tailwind/utils';
import { Navbar } from '@/widgets/layout/navbar/ui/Navbar';
import { Sidebar } from '@/widgets/layout/sidebar/ui/Sidebar';
import { BottomTabBar } from '@/widgets/layout/bottom-tab-bar/ui/BottomTabBar';
import { ScrollToTop } from '@/shared/ui/elements/ScrollToTop';
import { useHistoryOverlay } from '@/shared/hooks/useHistoryOverlay';

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: Readonly<AppLayoutProps>) {
  const isPostSubmitPage = useMatch(ROUTES_PATHS.POST.SUBMIT) !== null;
  const isPostEditPage = useMatch(ROUTES_PATHS.POST.EDIT) !== null;
  // '/post/:id'는 'submit'도 id로 읽는다 - 라우터는 정적 경로를 먼저 고르지만 useMatch는
  // 패턴 하나만 대조하므로 등록 화면을 직접 빼야 한다.
  const isPostDetailPage = useMatch('/post/:id') !== null && !isPostSubmitPage;
  // 맨 위로 버튼 - 글 등록·수정은 폼 화면이라 두지 않는다(모바일 등록 화면에서는 하단 등록
  // 바를 가린다). 글 상세는 데스크톱에만 둔다 - 모바일은 하단 댓글 바가 아래쪽을 차지하고
  // 버튼이 댓글의 수정·삭제 버튼을 가린다(근거는 docs/COMMENT.md "맨 위로 버튼").
  const showScrollToTop = !isPostSubmitPage && !isPostEditPage;
  const mainRef = useRef<HTMLElement>(null);

  // 모바일 검색 패널(RecentSearchPanel)은 시각적으로만 배경을 덮고 스크림·포커스
  // 트랩이 없다 - Tab 키로 배경 게시글·댓글에 그대로 포커스가 넘어간다. main만
  // inert로 막는다(Navbar·Sidebar·BottomTabBar는 main 밖 형제라 검색 중에도
  // 계속 조작 가능해야 한다 - Navbar.tsx:228 참고).
  const { isOpen: isMobileSearchOpen } = useHistoryOverlay('mobileSearchOpen');

  useLayoutEffect(
    function blockBackgroundDuringMobileSearch() {
      const node = mainRef.current;

      if (!node) {
        return;
      }

      // Tailwind md:(min-width:768px)와 같은 경계를 쓴다. 검색 패널이 md:hidden으로
      // 사라진 화면을 inert로 잠그면 닫을 UI가 없어진다(검색을 연 채로 창을 넓힌 경우).
      const desktop = window.matchMedia('(min-width: 768px)');

      function syncInert() {
        node!.inert = isMobileSearchOpen && !desktop.matches;
      }

      syncInert();
      desktop.addEventListener('change', syncInert);

      return () => {
        desktop.removeEventListener('change', syncInert);
        node.inert = false;
      };
    },
    [isMobileSearchOpen]
  );

  return (
    <div aria-label={TEXTS.ariaLabels.appLayout} className="min-h-screen flex">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <Navbar />
        <main
          ref={mainRef}
          className="flex-1 container max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 pb-28 md:py-4 md:pb-16"
          aria-label={TEXTS.ariaLabels.mainContent}
        >
          {children}
        </main>
      </div>
      <BottomTabBar />
      {showScrollToTop && (
        // contents라 박스를 만들지 않는다. 상세의 모바일 경계는 Tailwind md와 같다
        <div className={cn('contents', isPostDetailPage && 'max-md:hidden')}>
          <ScrollToTop />
        </div>
      )}
    </div>
  );
}
