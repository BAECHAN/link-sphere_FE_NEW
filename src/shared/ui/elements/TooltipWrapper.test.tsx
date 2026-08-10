import { act, fireEvent, waitFor } from '@testing-library/react';
import { toast } from '@/shared/lib/toast/toast';
import { renderWithProviders } from '@/test/utils';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';
import { Button } from '@/shared/ui/atoms/button';

// renderWithProviders에는 TooltipProvider가 없으므로 직접 감싼다.
function renderTooltipWrapper(content: string | null) {
  return renderWithProviders(
    <TooltipProvider>
      <TooltipWrapper content={content} disabled={!!content}>
        <Button disabled={!!content}>버튼</Button>
      </TooltipWrapper>
    </TooltipProvider>
  );
}

describe('TooltipWrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('터치로 탭하면 이유를 토스트로 보여준다', () => {
    const infoSpy = vi.spyOn(toast, 'info');
    const { getByRole } = renderTooltipWrapper('변경한 내용이 없어요.');

    fireEvent.pointerDown(getByRole('button'), { pointerType: 'touch' });

    expect(infoSpy).toHaveBeenCalledWith('변경한 내용이 없어요.', {
      id: 'tooltip-wrapper-reason',
    });
  });

  it('content가 없으면 터치해도 토스트를 띄우지 않는다', () => {
    const infoSpy = vi.spyOn(toast, 'info');
    const { getByRole } = renderTooltipWrapper(null);

    fireEvent.pointerDown(getByRole('button'), { pointerType: 'touch' });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  it('마우스 클릭으로는 토스트를 띄우지 않는다 (호버 툴팁과 중복 방지)', () => {
    const infoSpy = vi.spyOn(toast, 'info');
    const { getByRole } = renderTooltipWrapper('변경한 내용이 없어요.');

    fireEvent.pointerDown(getByRole('button'), { pointerType: 'mouse' });

    expect(infoSpy).not.toHaveBeenCalled();
  });

  function renderInFormWithSiblingInput() {
    return renderWithProviders(
      <TooltipProvider delayDuration={0}>
        <form>
          <input aria-label="닉네임" />
          <TooltipWrapper content="변경한 내용이 없어요." disabled>
            <Button disabled>저장</Button>
          </TooltipWrapper>
        </form>
      </TooltipProvider>
    );
  }

  it('마우스가 트리거 위에 있는 채로 같은 폼의 다른 입력창에 타이핑하면 즉시 닫히고, 시간이 지나도 마우스를 그대로 두면 다시 뜨지 않으며, 마우스를 뺐다가 다시 넣어야 최신 이유로 다시 뜬다', async () => {
    const { getByRole, queryByText, getAllByText } = renderInFormWithSiblingInput();
    const trigger = getByRole('button').parentElement as HTMLElement;

    // 1) 먼저 hover로 툴팁을 띄운다.
    fireEvent.pointerMove(trigger, { pointerType: 'mouse' });
    // Radix가 시각적 텍스트 + 스크린리더용 숨김 텍스트를 함께 렌더해 getByText는 "여러 개
    // 매칭"으로 터진다 - getAllByText로 하나 이상 뜨는지만 확인한다.
    await waitFor(() => expect(getAllByText('변경한 내용이 없어요.').length).toBeGreaterThan(0));

    // 2) 마우스는 그대로 둔 채, 같은 폼의 다른 입력창에 타이핑하면 즉시 닫힌다.
    fireEvent.input(getByRole('textbox', { name: '닉네임' }), { target: { value: 'a' } });
    expect(queryByText('변경한 내용이 없어요.')).not.toBeInTheDocument();

    // 3) 시간이 아무리 지나도, 마우스를 트리거에서 떼지 않으면 저절로 다시 뜨지 않는다.
    await act(() => new Promise((resolve) => setTimeout(resolve, 800)));
    expect(queryByText('변경한 내용이 없어요.')).not.toBeInTheDocument();

    // 4) 마우스를 트리거 밖으로 뺐다가 다시 넣어야만 그제서야 다시 뜬다.
    fireEvent.pointerLeave(trigger);
    fireEvent.pointerMove(trigger, { pointerType: 'mouse' });
    await waitFor(() => expect(getAllByText('변경한 내용이 없어요.').length).toBeGreaterThan(0));
  });
});
