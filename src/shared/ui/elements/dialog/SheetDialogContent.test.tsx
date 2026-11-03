import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { Dialog, DialogTitle } from '@/shared/ui/atoms/dialog';
import { SheetDialogContent } from '@/shared/ui/elements/dialog/SheetDialogContent';

// 2026-11-03 모바일 시트 닫힘 깜빡임 수정(docs/DECISIONS.md) — 시트는 DialogContent 대신 Portal·Overlay·Panel을
// 직접 조립한다. 데스크톱 분기는 고치기 전과 같은 클래스 집합이어야 하고, 모바일 분기는 딤과 시트가 같은 시간·
// 곡선을 쓰고 시트는 밀기만 해야 한다. 실제 계산된 애니메이션 값은 e2e(bookmark-sheet-motion.mobile.spec.ts)가 본다.
function renderSheet(isMobile: boolean) {
  renderWithProviders(
    <Dialog open>
      <SheetDialogContent isMobile={isMobile}>
        <DialogTitle>폴더 선택</DialogTitle>
      </SheetDialogContent>
    </Dialog>
  );

  const panel = screen.getByRole('dialog');
  const overlay = panel.previousElementSibling;

  if (!(overlay instanceof HTMLElement)) {
    throw new Error('overlay not found');
  }

  return { panel: [...panel.classList], overlay: [...overlay.classList] };
}

describe('SheetDialogContent', () => {
  it('데스크톱 분기는 고치기 전과 같은 중앙 모달 클래스 집합이다', () => {
    const { panel, overlay } = renderSheet(false);

    expect(panel.sort().join(' ')).toBe(
      'bg-background border data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-200 fixed gap-0 grid left-[50%] max-w-sm overflow-hidden p-0 shadow-lg sm:rounded-lg top-[50%] translate-x-[-50%] translate-y-[-50%] w-full z-modal'
    );
    expect(overlay).toContain('bg-scrim/80');
  });

  it('모바일 분기는 딤 32%이고, 딤과 시트가 같은 시간·곡선을 쓰며 시트는 밀기만 한다', () => {
    const { panel, overlay } = renderSheet(true);
    const timing = ['duration-300', 'ease-[cubic-bezier(0.32,0.72,0,1)]'];

    expect(overlay).toContain('bg-scrim/32');
    expect(overlay).not.toContain('bg-scrim/80');
    expect(overlay).toEqual(expect.arrayContaining(timing));
    expect(panel).toEqual(expect.arrayContaining(timing));
    expect(panel).toEqual(
      expect.arrayContaining([
        'data-[state=open]:slide-in-from-bottom',
        'data-[state=closed]:slide-out-to-bottom',
      ])
    );
    expect(panel.filter((name) => /fade-|zoom-|duration-200/.test(name))).toEqual([]);
  });
});
