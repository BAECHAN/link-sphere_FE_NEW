import * as React from 'react';
import {
  DIALOG_CONTENT_MOTION,
  DialogContent,
  DialogContentPanel,
  DialogOverlay,
  DialogPortal,
} from '@/shared/ui/atoms/dialog';
import { cn } from '@/shared/lib/tailwind/utils';

/**
 * 모바일 시트의 딤과 시트가 함께 쓰는 시간·곡선. 둘은 형제 요소라 --tw-duration·--tw-ease가 상속되지
 * 않아 양쪽에 붙인다 — 한쪽에만 두면 딤(기본 150ms)이 먼저 사라져 시트만 남는다. 곡선은 vaul이 드로어와
 * 딤에 함께 쓰는 값이다(근거와 기각한 값: docs/DECISIONS.md 2026-11-03).
 */
const SHEET_TIMING = 'duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]';

/**
 * 창 전체의 높이 상한 — 안쪽 목록에만 상한을 두면 위아래 고정 행(제목·확인 등)이 그 위에 더해져 화면을 넘는다.
 * 창을 세로로 쌓고(flex-col) 여기서 막으면, 스크롤 영역(overflow-y-auto)만 남는 높이로 줄어든다. vh는 주소창이
 * 숨은 높이(lvh) 기준이라 주소창이 보이는 폰에서 넘치므로 dvh를 쓴다. 가로로 돌린 폰은 폭이 넓어 중앙 모달
 * 분기를 타므로 그쪽도 화면 높이 안에 둔다(값과 근거: docs/BOOKMARK.md §5 "창 높이").
 */
const SHEET_MAX_HEIGHT = 'max-h-[70dvh]';
const MODAL_MAX_HEIGHT = 'max-h-[calc(100dvh-2rem)]';

export interface SheetDialogContentProps extends React.ComponentPropsWithoutRef<
  typeof DialogContent
> {
  /** 모바일: 하단 시트로 슬라이드업. 데스크탑: 중앙 모달(narrow). */
  isMobile: boolean;
}

/**
 * PostCardBookmarkFolderDialog 에서 처음 쓰인 모바일 바텀시트 ↔ 데스크탑 모달 전환 패턴의 공통 컴포넌트.
 * 폴더 선택 계열 UI(북마크 폴더 선택기, 등록 폼 폴더 픽커 등)에서 재사용한다.
 *
 * DialogContent 대신 Portal·Overlay·Panel을 직접 조립한다 — 모바일 시트만 딤을 옅게(32%, Material 3 scrim)
 * 하고 시트는 밀기만 하기 위해서다. 두 분기가 같은 트리 모양이라 회전으로 isMobile이 바뀌어도 다시
 * 마운트되지 않고 클래스만 바뀐다.
 */
export const SheetDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  SheetDialogContentProps
>(({ isMobile, className, showCloseButton = false, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay className={cn(isMobile && ['bg-scrim/32', SHEET_TIMING])} />
    <DialogContentPanel
      ref={ref}
      showCloseButton={showCloseButton}
      className={cn(
        // 모바일: 하단 시트
        isMobile
          ? [
              'bottom-0 top-auto left-0 right-0 translate-x-0 translate-y-0 max-w-full w-full rounded-t-2xl rounded-b-none border-b-0 p-0 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom',
              SHEET_TIMING,
              SHEET_MAX_HEIGHT,
            ]
          : [DIALOG_CONTENT_MOTION, 'max-w-sm p-0', MODAL_MAX_HEIGHT],
        'flex flex-col gap-0 overflow-hidden',
        className
      )}
      {...props}
    />
  </DialogPortal>
));
SheetDialogContent.displayName = 'SheetDialogContent';
