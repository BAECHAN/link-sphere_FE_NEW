import { afterEach, describe, expect, it, vi } from 'vitest';
import { http } from 'msw';
import {
  fireEvent,
  renderWithProviders,
  screen,
  userEvent,
  waitFor,
  waitRenderingEachStep,
} from '@/test/utils';
import { TEXTS } from '@/shared/config/texts';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { useAuthStore } from '@/shared/store/auth.store';
import { TooltipProvider } from '@/shared/ui/atoms/tooltip';
import { accountKeys } from '@/entities/account/api/account.keys';
import { CommentForm } from '@/features/comment/create/ui/CommentForm';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { server } from '@/mocks/server';

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const POST_ID = 'post-1';

// renderWithProviders에는 TooltipProvider가 없다(MobileCommentBar.test.tsx와 같은 이유) - 등록
// 버튼이 TooltipWrapper 안에 있어 직접 감싼다
function renderCommentForm() {
  return renderWithProviders(
    <TooltipProvider>
      <CommentForm postId={POST_ID} />
    </TooltipProvider>
  );
}

// 제출은 계정 조회가 끝나야 실제로 나간다(useCreateComment.test.tsx의 renderLoggedIn과 같은 이유)
async function renderLoggedInCommentForm() {
  useAuthStore.getState().setAuth('test-access-token');

  const view = renderCommentForm();

  await waitFor(() => expect(view.queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));

  return view;
}

/** 등록 요청이 보낸 본문을 모은다. 응답은 끝내지 않아 등록 뒤 흐름이 검증에 섞이지 않는다 */
function captureCreateRequests() {
  const contents: (string | undefined)[] = [];

  server.use(
    http.post(`${API_BASE_URL}${API_ENDPOINTS.post.postComment(POST_ID)}`, async ({ request }) => {
      const body = (await request.json()) as { content?: string };

      contents.push(body.content);
      await new Promise(() => {});
    })
  );

  return contents;
}

// 제출이 일어났다면 입력란 비우기까지 끝날 만큼 기다린다(비우기는 요청을 보내기 전에 한다)
const SUBMIT_SETTLE_MS = 20;

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

  // 한글 조합(IME) 중의 단축키 - 실제 자판으로 잰 이벤트 순서와 배경은 docs/COMMENT.md §10
  describe('한글 조합 중 등록 단축키', () => {
    it('조합 중에 ⌘+Enter를 누르면 조합이 끝난 뒤에 한 번 등록하고 입력란을 비운다', async () => {
      const user = userEvent.setup();
      const requests = captureCreateRequests();

      await renderLoggedInCommentForm();

      const textarea = screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);
      await user.type(textarea, '가나다');

      // 조합 중에 입력란을 비우면 브라우저가 뒤이어 확정하는 마지막 글자가 빈 입력란에 다시 들어간다
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true, isComposing: true });
      await waitRenderingEachStep(SUBMIT_SETTLE_MS);

      expect(textarea).toHaveValue('가나다');
      expect(requests).toEqual([]);

      fireEvent.compositionEnd(textarea, { data: '다' });

      await waitFor(() => expect(requests).toEqual(['가나다']));
      expect(textarea).toHaveValue('');
    });

    it('조합 중이 아니면 ⌘+Enter로 바로 등록한다', async () => {
      const user = userEvent.setup();
      const requests = captureCreateRequests();

      await renderLoggedInCommentForm();

      const textarea = screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);
      await user.type(textarea, '가나다');

      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

      await waitFor(() => expect(requests).toEqual(['가나다']));
      expect(textarea).toHaveValue('');
    });

    it('조합 중 ⌘+Enter 뒤에 다른 키를 누르면, 조합이 끝나도 등록하지 않는다', async () => {
      const user = userEvent.setup();
      const requests = captureCreateRequests();

      await renderLoggedInCommentForm();

      const textarea = screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);
      await user.type(textarea, '가나다');

      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true, isComposing: true });
      fireEvent.keyDown(textarea, { key: 'ㄱ', isComposing: true });
      fireEvent.compositionEnd(textarea, { data: '닥' });
      await waitRenderingEachStep(SUBMIT_SETTLE_MS);

      expect(textarea).toHaveValue('가나다');
      expect(requests).toEqual([]);
    });

    it('단축키 없이 조합만 끝나면 등록하지 않는다', async () => {
      const user = userEvent.setup();
      const requests = captureCreateRequests();

      await renderLoggedInCommentForm();

      const textarea = screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);
      await user.type(textarea, '가나다');

      fireEvent.compositionEnd(textarea, { data: '다' });
      await waitRenderingEachStep(SUBMIT_SETTLE_MS);

      expect(textarea).toHaveValue('가나다');
      expect(requests).toEqual([]);
    });
  });

  it('입력칸 아래 한글 기준 글자 수가 0부터 보이고, 입력칸의 설명으로 읽힌다', async () => {
    const user = userEvent.setup();

    renderCommentForm();

    const textarea = screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);
    expect(textarea).toHaveAccessibleDescription(
      `0 / 2,000${TEXTS.comment.form.contentCountSuffix}`
    );

    // 영어는 3바이트가 한글 1자 몫이다
    await user.type(textarea, 'abcd');

    expect(textarea).toHaveAccessibleDescription(
      `2 / 2,000${TEXTS.comment.form.contentCountSuffix}`
    );
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
