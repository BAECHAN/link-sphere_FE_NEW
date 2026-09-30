import { useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '@/test/utils';
import { DOUBLE_CLICK_GUARD_MS } from '@/shared/config/const';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from '@/shared/ui/atoms/alert-dialog';

// AlertDialogContent가 role="alertdialog"로 렌더되고, dialog.tsx에서 옮겨 심은 가드
// (열린 직후 안쪽 클릭 무시·IME 조합 중 ESC 무시)가 그대로 동작하는지, 바깥 클릭으로는
// 닫히지 않는지 검증한다(docs/DECISIONS.md 2026-09-30 "확인창을 Radix AlertDialog로 교체").

function ControlledAlertDialog({
  onConfirm,
  onOpenChange,
}: {
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        onOpenChange(next);
      }}
    >
      <AlertDialogContent>
        <AlertDialogTitle>확인</AlertDialogTitle>
        <AlertDialogDescription>정말 삭제할까요?</AlertDialogDescription>
        <button type="button" onClick={onConfirm}>
          삭제
        </button>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function renderAlertDialog() {
  const onConfirm = vi.fn();
  const onOpenChange = vi.fn();
  renderWithProviders(<ControlledAlertDialog onConfirm={onConfirm} onOpenChange={onOpenChange} />);

  return { onConfirm, onOpenChange };
}

async function waitForOpen() {
  await waitFor(() => expect(screen.getByRole('alertdialog')).toBeInTheDocument());
  // Radix DismissableLayer는 바깥 pointerdown 리스너를 setTimeout(0) 뒤에야 document에
  // 붙인다 — 실제 타이머를 한 틱 흘려보내 리스너가 붙을 시간을 준다(dialog.test.tsx와 같다).
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('AlertDialogContent', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('role="alertdialog"로 렌더되고 제목이 접근명이 된다', async () => {
    renderAlertDialog();
    await waitForOpen();

    expect(screen.getByRole('alertdialog', { name: '확인' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('열린 직후 내부 버튼 클릭은 무시한다', async () => {
    const { onConfirm } = renderAlertDialog();
    await waitForOpen();

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('가드 시간이 지난 뒤의 내부 버튼 클릭은 정상 동작한다', async () => {
    const { onConfirm } = renderAlertDialog();
    await waitForOpen();

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('가드 시간이 지난 뒤에도 바깥 pointerdown으로는 닫히지 않는다', async () => {
    const { onOpenChange } = renderAlertDialog();
    await waitForOpen();

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.pointerDown(document.body);

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  it('ESC로는 닫힌다', async () => {
    const { onOpenChange } = renderAlertDialog();
    await waitForOpen();

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it('한글 조합 중인 ESC는 무시한다', async () => {
    const { onOpenChange } = renderAlertDialog();
    await waitForOpen();

    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape', isComposing: true });

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it('닫기(X) 버튼은 가드 시간이 지난 뒤 닫는다', async () => {
    const { onOpenChange } = renderAlertDialog();
    await waitForOpen();

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  // 실제 사용처(GlobalAlerts)는 알럿마다 새로 마운트하지만, dialog.tsx와 같은 구조로 가드
  // 시계가 "마운트"가 아니라 "열린 시점"에서 시작하는지 확인한다(dialog.test.tsx 선례).
  it('닫힌 채 마운트됐다가 나중에 열려도 열린 직후 내부 클릭은 무시한다', async () => {
    const onConfirm = vi.fn();
    const content = (
      <AlertDialogContent>
        <AlertDialogTitle>확인</AlertDialogTitle>
        <AlertDialogDescription>정말 삭제할까요?</AlertDialogDescription>
        <button type="button" onClick={onConfirm}>
          삭제
        </button>
      </AlertDialogContent>
    );
    const { rerender } = renderWithProviders(<AlertDialog open={false}>{content}</AlertDialog>);

    vi.advanceTimersByTime(DOUBLE_CLICK_GUARD_MS * 10);

    rerender(<AlertDialog open>{content}</AlertDialog>);
    await waitForOpen();

    fireEvent.click(screen.getByRole('button', { name: '삭제' }));

    expect(onConfirm).not.toHaveBeenCalled();
  });
});
