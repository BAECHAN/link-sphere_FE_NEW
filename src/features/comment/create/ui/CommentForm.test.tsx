import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
import { useCopiedPostLinkStore } from '@/shared/store/copiedPostLink.store';
import { TooltipProvider } from '@baechan/ui/atoms/tooltip';
import { accountKeys } from '@/entities/account/api/account.keys';
import { CommentForm } from '@/features/comment/create/ui/CommentForm';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { server } from '@/mocks/server';

const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
const WINDOWS_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)';
const POST_ID = 'post-1';

// renderWithProviders에는 TooltipProvider가 없다(CommentComposer.test.tsx와 같은 이유) - 등록
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

// 글 카드의 공유 버튼으로 복사해 둔 다른 글의 링크를 빈 입력칸에 넣어 주는 제안(docs/COMMENT.md §5).
// 폼은 POST_ID 글의 댓글 폼이다
describe('CommentForm - 복사한 글 링크 넣기 제안', () => {
  const OTHER_POST_LINK = {
    postId: 'post-2',
    url: `${window.location.origin}/post/post-2`,
    title: '다른 글 제목',
  };
  const SUGGESTION_NAME = TEXTS.comment.form.insertCopiedLink(OTHER_POST_LINK.title);

  function rememberLink(link = OTHER_POST_LINK) {
    useCopiedPostLinkStore.setState({ copiedPostLink: link });
  }

  function getTextarea() {
    return screen.getByPlaceholderText<HTMLTextAreaElement>(TEXTS.comment.form.commentPlaceholder);
  }

  function querySuggestion(name = SUGGESTION_NAME) {
    return screen.queryByRole('button', { name });
  }

  beforeEach(() => {
    useCopiedPostLinkStore.setState({ copiedPostLink: null });
  });

  afterEach(() => {
    useCopiedPostLinkStore.setState({ copiedPostLink: null });
  });

  it('기억한 링크가 없으면 입력칸에 포커스해도 제안이 없다', async () => {
    const user = userEvent.setup();

    renderCommentForm();
    await user.click(getTextarea());

    expect(screen.queryByRole('button', { name: /링크 넣기/ })).not.toBeInTheDocument();
  });

  it('다른 글의 링크를 기억하고 있으면 포커스 전에는 없고 포커스하면 보인다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();

    expect(querySuggestion()).not.toBeInTheDocument();

    await user.click(getTextarea());

    expect(querySuggestion()).toBeInTheDocument();
  });

  it('지금 보고 있는 글의 링크면 포커스해도 제안이 없다', async () => {
    const user = userEvent.setup();
    const sameTitle = '지금 글 제목';
    rememberLink({
      postId: POST_ID,
      url: `${window.location.origin}/post/${POST_ID}`,
      title: sameTitle,
    });

    renderCommentForm();
    await user.click(getTextarea());

    expect(querySuggestion(TEXTS.comment.form.insertCopiedLink(sameTitle))).not.toBeInTheDocument();
  });

  it('제목이 빈 글은 제목 없는 문구로 제안한다', async () => {
    const user = userEvent.setup();
    rememberLink({ ...OTHER_POST_LINK, title: '' });

    renderCommentForm();
    await user.click(getTextarea());

    expect(querySuggestion(TEXTS.comment.form.insertCopiedLinkUntitled)).toBeInTheDocument();
  });

  it('글자를 입력하면 제안이 사라지고, 모두 지워도 돌아오지 않는다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();
    const textarea = getTextarea();
    await user.click(textarea);
    await user.keyboard('a');

    expect(querySuggestion()).not.toBeInTheDocument();

    await user.keyboard('{Backspace}');

    expect(textarea).toHaveValue('');
    expect(querySuggestion()).not.toBeInTheDocument();
  });

  it('입력칸을 벗어났다 다시 포커스하면 제안이 돌아온다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();
    const textarea = getTextarea();
    await user.click(textarea);
    await user.keyboard('a{Backspace}');

    expect(querySuggestion()).not.toBeInTheDocument();

    await user.click(document.body);
    await user.click(textarea);

    expect(querySuggestion()).toBeInTheDocument();
  });

  it('입력칸 밖으로 포커스가 나가면 제안이 사라진다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();
    await user.click(getTextarea());
    await user.click(document.body);

    expect(getTextarea()).not.toHaveFocus();
    expect(querySuggestion()).not.toBeInTheDocument();
  });

  it('맨 위 폼을 누른 뒤 답글 폼을 누르면 답글 폼에만 제안이 보인다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderWithProviders(
      <TooltipProvider>
        <CommentForm postId={POST_ID} />
        <CommentForm postId={POST_ID} parentId="comment-1" />
      </TooltipProvider>
    );
    const rootTextarea = getTextarea();
    const replyTextarea = screen.getByPlaceholderText(TEXTS.comment.form.replyPlaceholder);

    await user.click(rootTextarea);

    expect(screen.getAllByRole('button', { name: SUGGESTION_NAME })).toHaveLength(1);

    await user.click(replyTextarea);

    const suggestions = screen.getAllByRole('button', { name: SUGGESTION_NAME });

    expect(suggestions).toHaveLength(1);
    expect(replyTextarea.parentElement).toContainElement(suggestions[0] ?? null);
  });

  it('제안을 마우스로 누르고 있는 동안 입력칸이 포커스를 잃지 않고 제안도 남는다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();
    const textarea = getTextarea();
    await user.click(textarea);

    const suggestion = querySuggestion();

    expect(suggestion).toBeInTheDocument();

    await user.pointer({ keys: '[MouseLeft>]', target: suggestion as HTMLElement });

    expect(textarea).toHaveFocus();
    expect(querySuggestion()).toBeInTheDocument();
  });

  it('입력칸에서 Tab을 누르면 제안으로 간다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();
    await user.click(getTextarea());
    await user.tab();

    expect(querySuggestion()).toHaveFocus();
  });

  it('Tab으로 제안에 간 뒤 다시 Tab으로 나가면 제안이 사라진다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();
    await user.click(getTextarea());
    await user.tab();

    expect(querySuggestion()).toHaveFocus();

    await user.tab();

    expect(querySuggestion()).not.toBeInTheDocument();
  });

  it('제안을 누르면 주소와 공백 한 칸이 들어가고, 포커스가 입력칸으로 돌아오고, 기억과 제안이 사라진다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();
    const textarea = getTextarea();
    const submitButton = screen.getByRole('button', {
      name: new RegExp(TEXTS.comment.form.submitComment),
    });
    await user.click(textarea);

    expect(submitButton).toBeDisabled();

    await user.click(screen.getByRole('button', { name: SUGGESTION_NAME }));

    expect(textarea).toHaveValue(`${OTHER_POST_LINK.url} `);
    expect(textarea).toHaveFocus();
    expect(querySuggestion()).not.toBeInTheDocument();
    expect(useCopiedPostLinkStore.getState().copiedPostLink).toBeNull();
    expect(submitButton).toBeEnabled();
  });

  it('제안이 보여도 Enter는 줄바꿈으로 남는다', async () => {
    const user = userEvent.setup();
    rememberLink();

    renderCommentForm();
    const textarea = getTextarea();
    await user.click(textarea);

    expect(querySuggestion()).toBeInTheDocument();

    await user.keyboard('{Enter}');

    expect(textarea).toHaveValue('\n');
    expect(useCopiedPostLinkStore.getState().copiedPostLink).toEqual(OTHER_POST_LINK);
  });

  it('제안을 쓰지 않고 직접 써서 등록하면, 입력칸이 비어도 제안이 바로 돌아오지 않는다', async () => {
    const user = userEvent.setup();
    const requests = captureCreateRequests();
    rememberLink();

    await renderLoggedInCommentForm();

    const textarea = getTextarea();
    await user.click(textarea);
    await user.keyboard('직접 쓴 댓글');
    await user.keyboard('{Control>}{Enter}{/Control}');

    await waitFor(() => expect(requests).toEqual(['직접 쓴 댓글']));
    expect(textarea).toHaveValue('');
    expect(textarea).toHaveFocus();
    expect(querySuggestion()).not.toBeInTheDocument();
  });
});
