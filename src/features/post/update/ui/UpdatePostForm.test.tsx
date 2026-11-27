import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { createTestQueryClient, renderWithProviders, userEvent } from '@/test/utils';
import { UpdatePostForm } from '@/features/post/update/ui/UpdatePostForm';
import { postKeys } from '@/entities/post/api/post.keys';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';
import { TooltipProvider } from '@baechan/ui/atoms/tooltip';

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

describe('UpdatePostForm 공유 문구 나누기', () => {
  const { movedToTitle, urlOnly } = TEXTS.post.form.sharedText;
  const SHARED_TEXT = '알배기 독막로3길 35 2층 https://naver.me/abc';

  beforeEach(() => {
    useAuthStore.getState().setAuth('test-access-token');
  });

  it('URL 칸을 공유 문구로 바꾸면 URL 변경으로 비워진 제목에 앞 글자를 넣고, URL 변경 안내 대신 옮겼다고 알린다', async () => {
    const user = userEvent.setup();
    const { urlInput, titleInput } = await renderForm();

    // 전체 선택 뒤 붙여 넣어 한 번에 바꾼다 - 먼저 비우면 그때 이미 URL 변경으로 제목이 비워져 이 경로를 지나지 않는다
    await user.click(urlInput);
    (urlInput as HTMLInputElement).select();
    await user.paste(SHARED_TEXT);

    expect(urlInput).toHaveValue('https://naver.me/abc');
    await waitFor(() => expect(titleInput).toHaveValue('알배기 독막로3길 35 2층'));
    expect(screen.getByText(movedToTitle)).toBeInTheDocument();
    expect(screen.queryByText(urlChangedNotice)).not.toBeInTheDocument();
  });

  it('수정 요청에 나눈 URL과 앞 글자 제목이 한 글자도 빠지지 않고 실린다', async () => {
    let body: Record<string, unknown> | undefined;
    server.use(
      http.patch(`${API_BASE_URL}${API_ENDPOINTS.post.base}/:id`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;

        return HttpResponse.json({ status: 200, message: 'ok', data: mockPost });
      })
    );
    const user = userEvent.setup();
    const { urlInput, titleInput } = await renderForm();

    await user.click(urlInput);
    (urlInput as HTMLInputElement).select();
    await user.paste(
      '[네이버지도] 알배기 (망원) 독막로3길 35 2층 https://naver.me/abc?x=1&y=2#top'
    );
    await waitFor(() =>
      expect(titleInput).toHaveValue('[네이버지도] 알배기 (망원) 독막로3길 35 2층')
    );
    const saveButton = screen.getByRole('button', { name: TEXTS.post.form.update.update });
    await waitFor(() => expect(saveButton).toBeEnabled());
    await user.click(saveButton);

    await waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({
      url: 'https://naver.me/abc?x=1&y=2#top',
      title: '[네이버지도] 알배기 (망원) 독막로3길 35 2층',
    });
  });

  it('URL을 바꾼 뒤 직접 쓴 제목이 있으면 제목은 그대로 두고 URL만 남긴다', async () => {
    const user = userEvent.setup();
    const { urlInput, titleInput } = await renderForm();

    await user.clear(urlInput);
    await user.type(urlInput, 'https://example.com/another-article');
    await user.type(titleInput, '내가 쓴 제목');
    await user.clear(urlInput);
    await user.paste(SHARED_TEXT);

    expect(urlInput).toHaveValue('https://naver.me/abc');
    expect(await screen.findByText(urlOnly)).toBeInTheDocument();
    expect(titleInput).toHaveValue('내가 쓴 제목');
  });
});
