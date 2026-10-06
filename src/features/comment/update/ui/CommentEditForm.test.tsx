import { describe, it, expect, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import { renderWithProviders, screen, userEvent } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { TEXTS } from '@/shared/config/texts';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';
import { CommentEditForm } from '@/features/comment/update/ui/CommentEditForm';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

describe('CommentEditForm', () => {
  it('저장이 실패하면 버튼 위에 원인 안내를 보여주고, 입력을 고치면 지운다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.post.comment(mockComment.id)), () =>
        HttpResponse.json(
          { status: 409, code: 'COMMENT_DELETED', message: 'deleted', timestamp: '' },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();

    // renderWithProviders에는 TooltipProvider가 없다(MobileCommentBar.test.tsx와 같은 이유) - 저장
    // 버튼이 TooltipWrapper 안에 있어 직접 감싼다
    renderWithProviders(
      <TooltipProvider>
        <CommentEditForm
          comment={mockComment}
          postId={mockPost.id}
          onCancel={vi.fn()}
          onSuccess={vi.fn()}
        />
      </TooltipProvider>
    );

    const textarea = screen.getByPlaceholderText(TEXTS.comment.form.editPlaceholder);
    await user.type(textarea, ' (수정)');
    await user.click(screen.getByRole('button', { name: /저장/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      TEXTS.messages.error.commentSubmit.commentDeleted
    );

    await user.type(textarea, '!');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
