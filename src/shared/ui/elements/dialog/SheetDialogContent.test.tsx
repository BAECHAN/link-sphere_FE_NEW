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
  // 2026-11-03 창 높이 — 창을 세로로 쌓고(grid → flex flex-col) 창 전체에 화면 높이 상한을 더한 것 말고는
  // 중앙 모달의 클래스가 그대로여야 한다(docs/BOOKMARK.md §5 "창 높이")
  it('데스크톱 분기는 중앙 모달 클래스 집합에 세로 쌓기와 화면 높이 상한만 더한다', () => {
    const { panel, overlay } = renderSheet(false);

    expect(panel.sort().join(' ')).toBe(
      'bg-background border data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-d4 fixed flex flex-col gap-0 left-[50%] max-h-[calc(100dvh-2rem)] max-w-sm overflow-hidden p-0 shadow-s4 sm:rounded-lg top-[50%] translate-x-[-50%] translate-y-[-50%] w-full z-modal'
    );
    expect(overlay).toContain('bg-scrim/80');
  });

  it('모바일 분기는 창 전체가 보이는 화면 높이의 70%를 넘지 않는다', () => {
    const { panel } = renderSheet(true);

    expect(panel).toEqual(expect.arrayContaining(['flex', 'flex-col', 'max-h-[70dvh]']));
    expect(panel).not.toContain('grid');
  });

  it('모바일 분기는 딤 32%이고, 딤과 시트가 같은 시간·곡선을 쓰며 시트는 밀기만 한다', () => {
    const { panel, overlay } = renderSheet(true);
    const timing = ['duration-d6', 'ease-sheet'];

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
    expect(panel.filter((name) => /fade-|zoom-|duration-d4/.test(name))).toEqual([]);
  });

  // 2026-11-26 딤 시간 맞추기 — 딤 기본 시간(d4)을 더한 뒤에도 데스크톱 딤은 창과 같은 시간이고, 모바일 딤은
  // 넘긴 시트 시간(d6)이 cn()으로 기본 시간을 덮는다
  it('데스크톱 분기의 딤은 창과 같은 시간(d4)이다', () => {
    const { panel, overlay } = renderSheet(false);
    const durations = (names: string[]) => names.filter((name) => name.startsWith('duration-'));

    expect(durations(panel)).toEqual(['duration-d4']);
    expect(durations(overlay)).toEqual(durations(panel));
  });

  it('모바일 분기의 딤에는 시트 시간(d6)만 남는다', () => {
    const { overlay } = renderSheet(true);

    expect(overlay.filter((name) => name.startsWith('duration-'))).toEqual(['duration-d6']);
  });
});
