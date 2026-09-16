import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderWithProviders, userEvent } from '@/test/utils';
import { MobileCommentBar } from '@/features/comment/create/ui/MobileCommentBar';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';
import { TEXTS } from '@/shared/config/texts';

// Navbar.tsx:69-77과 같은 방식(location.state.mobileSearchOpen)으로 검색 열림/닫힘을
// 흉내 내는 테스트 전용 프로브. open은 같은 경로로 새 엔트리를 push하고, close는
// navigate(-1)로 그 엔트리를 pop한다.
function SearchToggleProbe() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <>
      <button
        type="button"
        onClick={() => navigate(location.pathname, { state: { mobileSearchOpen: true } })}
      >
        open-search
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        close-search
      </button>
    </>
  );
}

// renderWithProviders에는 TooltipProvider가 없다(TooltipWrapper.test.tsx와 동일한 이유) -
// 펼침 상태의 CommentForm이 TooltipWrapper(길이 초과 안내 등)를 렌더하므로 직접 감싼다.
function renderMobileCommentBar() {
  return renderWithProviders(
    <TooltipProvider>
      <MobileCommentBar postId="post-1" />
      <SearchToggleProbe />
    </TooltipProvider>,
    { wrapperOptions: { initialEntries: ['/post/post-1'] } }
  );
}

describe('MobileCommentBar — 모바일 검색 오버레이와의 겹침', () => {
  it('기본 상태에서는 숨겨지지 않고 토스트 오프셋이 설정된다', () => {
    renderMobileCommentBar();

    const trigger = screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand });
    expect(trigger.closest('div')).not.toHaveClass('hidden');
    expect(document.documentElement.style.getPropertyValue('--toast-offset-bottom')).not.toBe('');
  });

  it('검색이 열리면 접힘 상태의 바가 숨겨지고 토스트 오프셋이 제거된다', async () => {
    const user = userEvent.setup();
    renderMobileCommentBar();

    // hidden(display:none)이 걸리면 getByRole은 기본적으로 접근성 트리에서 제외된
    // 요소를 찾지 못한다 — 숨겨지기 전에 참조를 먼저 잡아둔다.
    const trigger = screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand });

    await user.click(screen.getByRole('button', { name: 'open-search' }));

    expect(trigger.closest('div')).toHaveClass('hidden');
    expect(document.documentElement.style.getPropertyValue('--toast-offset-bottom')).toBe('');
  });

  it('펼친 상태에서 검색이 열리면 시트도 숨겨진다', async () => {
    const user = userEvent.setup();
    renderMobileCommentBar();

    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));
    const textarea = screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);

    await user.click(screen.getByRole('button', { name: 'open-search' }));

    expect(textarea.closest('form')?.parentElement).toHaveClass('hidden');
  });

  it('검색을 열었다 닫아도 작성 중이던 내용이 사라지지 않는다', async () => {
    const user = userEvent.setup();
    renderMobileCommentBar();

    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));
    await user.type(
      screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder),
      '작성 중인 댓글'
    );

    await user.click(screen.getByRole('button', { name: 'open-search' }));
    await user.click(screen.getByRole('button', { name: 'close-search' }));

    expect(screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder)).toHaveValue(
      '작성 중인 댓글'
    );
  });
});
