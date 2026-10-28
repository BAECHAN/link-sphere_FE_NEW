import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';
import { CommentForm } from '@/features/comment/create/ui/CommentForm';

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';

// renderWithProviders에는 TooltipProvider가 없다(MobileCommentBar.test.tsx와 같은 이유) - 등록
// 버튼이 TooltipWrapper 안에 있어 직접 감싼다
function renderCommentForm() {
  return renderWithProviders(
    <TooltipProvider>
      <CommentForm postId="post-1" />
    </TooltipProvider>
  );
}

describe('CommentForm', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Windows·안드로이드 키보드에는 ⌘가 없다 - 사이드바(Sidebar.tsx)처럼 ⌘와 Ctrl을 둘 다 받는다.
  // 빈 폼이면 제출 경로가 그 폼을 강조하므로, 요청 없이 단축키가 먹었는지 볼 수 있다
  it('빈 폼에서 Ctrl+Enter를 누르면 제출 경로를 타 그 폼을 강조한다', async () => {
    const user = userEvent.setup();

    renderCommentForm();

    const textarea = screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);
    expect(textarea).toHaveAttribute('aria-invalid', 'false');

    await user.click(textarea);
    await user.keyboard('{Control>}{Enter}{/Control}');

    expect(textarea).toHaveAttribute('aria-invalid', 'true');
  });

  it.each([
    ['Mac', TEXTS.shortcuts.commentSubmitMac, MAC_UA],
    ['Windows', TEXTS.shortcuts.commentSubmit, WINDOWS_UA],
  ])('%s에서는 등록 버튼 힌트를 %s 키로 보여준다', (_os, hint, userAgent) => {
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(userAgent);

    renderCommentForm();

    expect(
      screen.getByRole('button', { name: new RegExp(TEXTS.comment.form.submitComment) })
    ).toHaveTextContent(hint);
  });
});
