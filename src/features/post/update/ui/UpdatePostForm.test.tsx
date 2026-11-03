import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { createTestQueryClient, renderWithProviders, userEvent } from '@/test/utils';
import { UpdatePostForm } from '@/features/post/update/ui/UpdatePostForm';
import { postKeys } from '@/entities/post/api/post.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';

vi.mock('@/shared/hooks/useGoBack', () => ({ useGoBack: () => vi.fn() }));
// 관심 분야 목록은 이 테스트가 보는 안내 문구와 무관하다 - 목 서버에 핸들러가 없어 빈 목록으로 둔다
vi.mock('@/entities/category/hooks/useCategoryOptions', () => ({
  useCategoryOptions: () => ({ categoryOptionList: [] }),
}));

const { urlChangedNotice, titleClearedNotice } = TEXTS.post.form.update;

async function renderForm() {
  const queryClient = createTestQueryClient({ staleTime: Infinity });
  queryClient.setQueryData(postKeys.detail(mockPost.id), mockPost);
  // renderWithProviders에는 TooltipProvider가 없다 - 저장 버튼의 TooltipWrapper가 요구한다(CommentEditForm.test.tsx와 같은 이유)
  renderWithProviders(
    <TooltipProvider>
      <UpdatePostForm postId={mockPost.id} />
    </TooltipProvider>,
    { wrapperOptions: { queryClient } }
  );

  // 불러온 글로 폼을 채운 뒤부터 본다
  const titleInput = await screen.findByDisplayValue(mockPost.title);
  const urlInput = screen.getByDisplayValue(mockPost.url);

  return { urlInput, titleInput };
}

describe('UpdatePostForm 안내 문구', () => {
  beforeEach(() => {
    // 저장은 로그인 상태에서만 보낸다(useAuthGuard) - 셋업이 테스트마다 로그인 상태를 지운다
    useAuthStore.getState().setAuth('test-access-token');
  });

  it('수정 화면을 열면 URL 변경 안내도 제목 비움 안내도 없다', async () => {
    await renderForm();

    expect(screen.queryByText(urlChangedNotice)).not.toBeInTheDocument();
    expect(screen.queryByText(titleClearedNotice)).not.toBeInTheDocument();
  });

  it('URL을 바꾸면 URL 변경 안내가 보이고, 비워진 제목의 안내는 겹치지 않게 숨긴다', async () => {
    const user = userEvent.setup();
    const { urlInput, titleInput } = await renderForm();

    await user.clear(urlInput);
    await user.type(urlInput, 'https://example.com/another-article');

    expect(await screen.findByText(urlChangedNotice)).toBeInTheDocument();
    expect(titleInput).toHaveValue('');
    expect(screen.queryByText(titleClearedNotice)).not.toBeInTheDocument();
  });

  it('URL은 그대로 두고 제목을 비우면 제목 비움 안내가 보인다', async () => {
    const user = userEvent.setup();
    const { titleInput } = await renderForm();

    await user.clear(titleInput);

    expect(await screen.findByText(titleClearedNotice)).toBeInTheDocument();
    expect(screen.queryByText(urlChangedNotice)).not.toBeInTheDocument();
  });

  // 안내 판정은 공백을 다듬지 않고 비교한다 - 미리보기 판정(useUpdatePost의 isUrlChanged)은 trim()한다.
  // 어느 쪽으로 맞출지 정하기 전까지 지금 동작을 고정해 둔다(docs/plans/2026-11-03-usewatch-remaining.md "남은 것")
  it('URL 끝에 공백만 붙여도 URL 변경 안내가 보인다', async () => {
    const user = userEvent.setup();
    const { urlInput } = await renderForm();

    await user.type(urlInput, ' ');

    expect(await screen.findByText(urlChangedNotice)).toBeInTheDocument();
  });
});
