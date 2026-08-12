import * as React from 'react';
import { DialogContent } from '@/shared/ui/atoms/dialog';
import { cn } from '@/shared/lib/tailwind/utils';

interface SheetDialogContentProps extends React.ComponentPropsWithoutRef<typeof DialogContent> {
  /** 모바일: 하단 시트로 슬라이드업. 데스크탑: 중앙 모달(narrow). */
  isMobile: boolean;
}

/**
 * FolderSelector 에서 처음 쓰인 모바일 바텀시트 ↔ 데스크탑 모달 전환 패턴의 공통 컴포넌트.
 * 폴더 선택 계열 UI(북마크 폴더 선택기, 등록 폼 폴더 픽커 등)에서 재사용한다.
 */
export const SheetDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogContent>,
  SheetDialogContentProps
>(({ isMobile, className, showCloseButton = false, ...props }, ref) => (
  <DialogContent
    ref={ref}
    showCloseButton={showCloseButton}
    className={cn(
      // 모바일: 하단 시트
      isMobile
        ? 'bottom-0 top-auto left-0 right-0 translate-x-0 translate-y-0 max-w-full w-full rounded-t-2xl rounded-b-none border-b-0 p-0 data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom'
        : 'max-w-sm p-0',
      'gap-0 overflow-hidden',
      className
    )}
    {...props}
  />
));
SheetDialogContent.displayName = 'SheetDialogContent';
