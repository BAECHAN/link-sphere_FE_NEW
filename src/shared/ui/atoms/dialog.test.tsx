import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import { Dialog, DialogContent, DialogTitle } from '@/shared/ui/atoms/dialog';

// DialogContent가 열린 직후(더블클릭/더블탭 관통 방지) 클릭을 무시하는지 검증한다.
// 2026-09-29부터 useOpenClickGuard(원래 BookmarkFolderSelectModal 한 곳에만 배선돼 있던 것)가
// 이 atom으로 올라와 Alert/Confirm을 포함한 모든 Dialog 기반 모달에 공통 적용된다
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

  // 실제 사용처(BookmarkFolderSelectModal 등)는 <Dialog open={false}>로 먼저 마운트해 두고
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
