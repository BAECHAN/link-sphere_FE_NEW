import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/atoms/dialog';

// DialogContent가 열린 직후(더블클릭/더블탭 관통 방지) 클릭을 무시하는지 검증한다.
// 2026-09-29부터 useOpenClickGuard(원래 BookmarkFolderSelectDialog 한 곳에만 배선돼 있던 것)가
// 이 atom으로 올라와 모든 Dialog 기반 모달에 공통 적용된다(확인창(Alert/Confirm)은 2026-09-30부터
// alert-dialog.tsx가 같은 가드를 갖는다 — alert-dialog.test.tsx 참고)
// (docs/BOOKMARK.md §5, docs/plans/2026-09-29-dialog-open-click-guard.md 참고).

function ControlledDialog({
  onConfirm,
  onOpenChange,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogTitle>확인</DialogTitle>
        <button type="button" onClick={onConfirm}>
          삭제
        </button>
      </DialogContent>
    </Dialog>
  );
}

describe('DialogContent — 열린 직후 클릭 가드', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('열린 직후 내부 버튼 클릭은 무시한다', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<ControlledDialog onConfirm={onConfirm} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('가드 시간이 지난 뒤의 내부 버튼 클릭은 정상 동작한다', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<ControlledDialog onConfirm={onConfirm} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('열린 직후 바깥 pointerdown으로는 닫히지 않는다', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<ControlledDialog onConfirm={onConfirm} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    // Radix DismissableLayer는 바깥 pointerdown 리스너를 setTimeout(0) 뒤에야 document에
    // 붙인다 — 실제 타이머를 한 틱 흘려보내 리스너가 붙을 시간을 준다.
    await new Promise((resolve) => setTimeout(resolve, 0));

    fireEvent.pointerDown(document.body);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('가드 시간이 지난 뒤의 바깥 pointerdown은 정상적으로 닫는다', async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    renderWithProviders(<ControlledDialog onConfirm={onConfirm} onOpenChange={onOpenChange} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 0));

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.pointerDown(document.body);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('Content 자체의 onClick(ImageViewer 형태)도 열린 직후에는 무시한다', async () => {
    const onContentClick = vi.fn();
    renderWithProviders(
      <Dialog open>
        <DialogContent onClick={onContentClick}>
          <DialogTitle>이미지</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('dialog'));
    expect(onContentClick).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.click(screen.getByRole('dialog'));
    expect(onContentClick).toHaveBeenCalledTimes(1);
  });

  // 실제 사용처(BookmarkFolderSelectDialog 등)는 <Dialog open={false}>로 먼저 마운트해 두고
  // 나중에 open을 true로 바꾼다 — 이때 가드 시계가 "마운트"가 아니라 "열린 시점"에서
  // 시작해야 한다(2026-09-30, 페이지 로드 시점에 시계가 찍혀 가드가 한 번도 안 걸리던 회귀)
  it('닫힌 채 마운트됐다가 나중에 열려도 열린 직후 바깥 pointerdown으로는 닫히지 않는다', async () => {
    const onOpenChange = vi.fn();
    const { rerender } = renderWithProviders(
      <Dialog open={false} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>확인</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS * 10);

    rerender(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogTitle>확인</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    await new Promise((resolve) => setTimeout(resolve, 0));

    fireEvent.pointerDown(document.body);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

// 바깥 클릭 닫기 정책(2026-09-30, docs/DECISIONS.md) — 닫히면 입력이 사라지는 모달(입력이 생긴
// 로그인 모달)은 dismissOnOutsideClick={false}로 바깥 클릭을 무시한다. ESC는 그대로 닫는다.
// 확인창(Alert/Confirm)은 alert-dialog.tsx가 항상 막는다(alert-dialog.test.tsx 참고).
describe('DialogContent — dismissOnOutsideClick', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderDialog(dismissOnOutsideClick?: boolean) {
    const onOpenChange = vi.fn();
    renderWithProviders(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent dismissOnOutsideClick={dismissOnOutsideClick}>
          <DialogTitle>확인</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    return onOpenChange;
  }

  async function waitForOutsideListener() {
    await waitFor(() => expect(screen.getByRole('dialog')).toBeInTheDocument());
    // Radix DismissableLayer는 바깥 pointerdown 리스너를 setTimeout(0) 뒤에 붙인다
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('false면 가드 시간이 지난 뒤의 바깥 pointerdown에도 닫히지 않는다', async () => {
    const onOpenChange = renderDialog(false);
    await waitForOutsideListener();

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.pointerDown(document.body);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('false여도 ESC로는 닫힌다', async () => {
    const onOpenChange = renderDialog(false);
    await waitForOutsideListener();

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('기본값(true)은 가드 시간이 지난 뒤의 바깥 pointerdown으로 닫힌다', async () => {
    const onOpenChange = renderDialog();
    await waitForOutsideListener();

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.pointerDown(document.body);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

// 모션 클래스를 DIALOG_CONTENT_MOTION으로 떼어 낸 뒤에도(2026-11-03, 하단 시트만 밀기로 바꾸려고) 기존
// DialogContent 사용처의 패널 클래스 집합이 그대로인지 고정한다. 기댓값은 고치기 전 dialog.tsx의 패널 기본
// 클래스에 각 사용처의 className을 cn()으로 합친 결과다(기본·LoginDialog·ImageViewer)
describe('DialogContent — 패널 클래스 집합', () => {
  function panelClassSet(className?: string) {
    renderWithProviders(
      <Dialog open>
        <DialogContent className={className}>
          <DialogTitle>확인</DialogTitle>
        </DialogContent>
      </Dialog>
    );

    return [...screen.getByRole('dialog').classList].sort().join(' ');
  }

  it('className이 없으면 흐림·확대 200ms가 붙은 중앙 모달 그대로다', () => {
    expect(panelClassSet()).toBe(
      'bg-background border data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-200 fixed gap-4 grid left-[50%] max-w-lg p-6 shadow-lg sm:rounded-lg top-[50%] translate-x-[-50%] translate-y-[-50%] w-full z-modal'
    );
  });

  it('LoginDialog의 max-w-md는 기본 폭만 바꾼다', () => {
    expect(panelClassSet('max-w-md')).toBe(
      'bg-background border data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-200 fixed gap-4 grid left-[50%] max-w-md p-6 shadow-lg sm:rounded-lg top-[50%] translate-x-[-50%] translate-y-[-50%] w-full z-modal'
    );
  });

  it('ImageViewer의 className도 같은 집합이 된다(닫힘 타이머 300ms가 기대는 duration-200 유지)', () => {
    expect(
      panelClassSet(
        'flex h-[90vh] w-[90vw] max-w-none items-center justify-center gap-0 border-0 bg-transparent p-0 shadow-none sm:rounded-none'
      )
    ).toBe(
      'bg-transparent border-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 duration-200 fixed flex gap-0 h-[90vh] items-center justify-center left-[50%] max-w-none p-0 shadow-none sm:rounded-none top-[50%] translate-x-[-50%] translate-y-[-50%] w-[90vw] z-modal'
    );
  });
});
