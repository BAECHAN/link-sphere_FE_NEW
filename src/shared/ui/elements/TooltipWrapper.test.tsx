import { fireEvent } from '@testing-library/react';
import { toast } from '@/shared/lib/toast/toast';
import { renderWithProviders } from '@/test/utils';
import { TooltipWrapper } from '@/shared/ui/elements/TooltipWrapper';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';
import { Button } from '@/shared/ui/atoms/button';

// renderWithProviders에는 TooltipProvider가 없으므로 직접 감싼다.
function renderTooltipWrapper(content: string | null) {
  return renderWithProviders(
    <TooltipProvider>
      <TooltipWrapper content={content}>
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
});
