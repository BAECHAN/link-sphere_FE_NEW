import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation, useNavigate } from 'react-router-dom';
import { renderWithDataRouter, userEvent } from '@/test/utils';
import { CommentComposer } from '@/features/comment/create/ui/CommentComposer';
import type { CommentFormHandle } from '@/features/comment/create/ui/CommentForm';
import { TooltipProvider } from '@baechan/ui/atoms/tooltip';
import { TEXTS } from '@/shared/config/texts';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { useAuthStore } from '@/shared/store/auth.store';
import { useUnsavedChangesStore } from '@/shared/store/unsavedChanges.store';
import { accountKeys } from '@/entities/account/api/account.keys';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { server } from '@/mocks/server';

const POST_ID = 'post-1';
const UNSAVED_KEY = `comment-create:${POST_ID}:root`;

// setup.ts의 matchMedia 스텁은 matches:false(넓은 화면) 고정이다. 좁은 화면과 폭이 경계를 넘는 순간을 재현하려고
// 이 파일에서 다시 씌운다(useIsMobile.test.ts와 같은 방식 - vi.unstubAllGlobals()는 setup.ts의 다른 스텁까지
// 걷어내므로 쓰지 않고 afterEach에서 원래 모양으로 되돌린다).
function stubViewport(initial: 'narrow' | 'wide') {
  const media = { matches: initial === 'narrow' };
  const listeners: Array<() => void> = [];

  vi.stubGlobal('matchMedia', (query: string) => ({
    get matches() {
      return media.matches;
    },
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));

  return {
    /** 폭이 768px 경계를 넘는다 */
    resizeTo(next: 'narrow' | 'wide') {
      media.matches = next === 'narrow';
      act(() => listeners.forEach((listener) => listener()));
    },
  };
}

// useMobileSearchPanel.ts의 openMobileSearch와 같은 방식(location.state.mobileSearchOpen)으로 검색 열림/닫힘을
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

// 테스트 render 함수에는 TooltipProvider가 없다(TooltipWrapper.test.tsx와 동일한 이유) -
// 펼침 상태의 폼이 TooltipWrapper(길이 초과 안내 등)를 렌더하므로 직접 감싼다.
// 검색 열림을 라우터가 가 있는 위치에서 읽으므로(useBackClosableOverlay) 앱과 같은 데이터 라우터로 그린다.
function renderCommentComposer(ref?: React.Ref<CommentFormHandle>) {
  return renderWithDataRouter(
    <TooltipProvider>
      <CommentComposer ref={ref} postId={POST_ID} />
      <SearchToggleProbe />
    </TooltipProvider>,
    { wrapperOptions: { initialEntries: [`/post/${POST_ID}`] } }
  );
}

function getInput() {
  return screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);
}

function queryInput() {
  return screen.queryByPlaceholderText(TEXTS.comment.form.commentPlaceholder);
}

function queryCollapsedBar() {
  return screen.queryByRole('button', { name: TEXTS.ariaLabels.commentBarExpand });
}

afterEach(() => {
  stubViewport('wide');
  useUnsavedChangesStore.setState({ dirtyKeys: new Set() });
});

describe('CommentComposer — 모바일 검색 오버레이와의 겹침', () => {
  it('기본 상태에서는 숨겨지지 않고 토스트 오프셋이 설정된다', () => {
    stubViewport('narrow');
    renderCommentComposer();

    const trigger = screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand });
    expect(trigger.closest('div')).not.toHaveClass('hidden');
    expect(document.documentElement.style.getPropertyValue('--toast-offset-bottom')).not.toBe('');
  });

  it('검색이 열리면 접힘 상태의 바가 숨겨지고 토스트 오프셋이 제거된다', async () => {
    stubViewport('narrow');
    const user = userEvent.setup();
    renderCommentComposer();

    // hidden(display:none)이 걸리면 getByRole은 기본적으로 접근성 트리에서 제외된
    // 요소를 찾지 못한다 — 숨겨지기 전에 참조를 먼저 잡아둔다.
    const trigger = screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand });

    await user.click(screen.getByRole('button', { name: 'open-search' }));

    expect(trigger.closest('div')).toHaveClass('hidden');
    expect(document.documentElement.style.getPropertyValue('--toast-offset-bottom')).toBe('');
  });

  it('펼친 상태에서 검색이 열리면 시트도 숨겨진다', async () => {
    stubViewport('narrow');
    const user = userEvent.setup();
    renderCommentComposer();

    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));
    const textarea = screen.getByPlaceholderText(TEXTS.comment.form.commentPlaceholder);

    await user.click(screen.getByRole('button', { name: 'open-search' }));

    expect(textarea.closest('form')?.parentElement).toHaveClass('hidden');
  });

  it('검색을 열었다 닫아도 작성 중이던 내용이 사라지지 않는다', async () => {
    stubViewport('narrow');
    const user = userEvent.setup();
    renderCommentComposer();

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

// 폭마다 다른 폼을 그리던 때에는 경계를 넘으면 쓰던 글이 사라졌다(docs/COMMENT.md §10)
describe('CommentComposer — 폭이 경계를 넘을 때', () => {
  it('넓은 화면에서 쓰던 글은 좁아져도 같은 입력칸에 남고 포커스도 그대로다', async () => {
    const viewport = stubViewport('wide');
    const user = userEvent.setup();
    renderCommentComposer();

    const input = getInput();

    await user.type(input, '쓰던 댓글');
    viewport.resizeTo('narrow');

    // 새로 그린 입력칸이 아니라 같은 요소여야 커서와 포커스가 이어진다
    expect(getInput()).toBe(input);
    expect(input).toHaveValue('쓰던 댓글');
    expect(input).toHaveFocus();
    expect(queryCollapsedBar()).not.toBeInTheDocument();

    viewport.resizeTo('wide');

    expect(getInput()).toBe(input);
    expect(input).toHaveValue('쓰던 댓글');
    expect(input).toHaveFocus();
  });

  it('좁은 화면 시트에서 쓰던 글은 넓어져도 같은 입력칸에 남는다', async () => {
    const viewport = stubViewport('narrow');
    const user = userEvent.setup();
    renderCommentComposer();

    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));

    const input = getInput();

    await user.type(input, '시트에서 쓰던 댓글');
    viewport.resizeTo('wide');

    expect(getInput()).toBe(input);
    expect(input).toHaveValue('시트에서 쓰던 댓글');
    expect(input.closest('form')?.parentElement).not.toHaveClass('fixed');
  });

  it('쓰던 글이 있는 동안에는 폭이 바뀌어도 이탈 확인 등록이 끊기지 않는다', async () => {
    const viewport = stubViewport('wide');
    const user = userEvent.setup();
    renderCommentComposer();

    await user.type(getInput(), '쓰던 댓글');
    expect(useUnsavedChangesStore.getState().dirtyKeys.has(UNSAVED_KEY)).toBe(true);

    // 등록이 한 번이라도 풀리는지 보려고 폭이 바뀌는 사이의 변화를 모은다
    const seen: boolean[] = [];
    const unsubscribe = useUnsavedChangesStore.subscribe((state) =>
      seen.push(state.dirtyKeys.has(UNSAVED_KEY))
    );

    viewport.resizeTo('narrow');
    viewport.resizeTo('wide');
    unsubscribe();

    expect(seen).not.toContain(false);
    expect(useUnsavedChangesStore.getState().dirtyKeys.has(UNSAVED_KEY)).toBe(true);
  });

  it('쓰던 글이 없으면 좁아질 때 접힌 바만 보인다', () => {
    const viewport = stubViewport('wide');
    renderCommentComposer();

    viewport.resizeTo('narrow');

    expect(queryCollapsedBar()).toBeInTheDocument();
    expect(queryInput()).not.toBeInTheDocument();
  });

  it('빈 시트를 펼쳐 둔 채 넓혔다가 다시 좁히면 접힌 바로 돌아온다', async () => {
    const viewport = stubViewport('narrow');
    const user = userEvent.setup();
    renderCommentComposer();

    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));
    viewport.resizeTo('wide');
    viewport.resizeTo('narrow');

    expect(queryCollapsedBar()).toBeInTheDocument();
    expect(queryInput()).not.toBeInTheDocument();
  });
});

describe('CommentComposer — 좁은 화면의 바와 시트', () => {
  it('접힌 바를 누르면 시트가 펼쳐지고 입력칸에 포커스가 간다', async () => {
    stubViewport('narrow');
    const user = userEvent.setup();
    renderCommentComposer();

    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));

    expect(getInput()).toHaveFocus();
    expect(queryCollapsedBar()).not.toBeInTheDocument();
  });

  it('취소하면 쓰던 글을 버리고 접힌다', async () => {
    const viewport = stubViewport('narrow');
    const user = userEvent.setup();
    renderCommentComposer();

    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));
    await user.type(getInput(), '버릴 댓글');
    await user.click(screen.getByRole('button', { name: TEXTS.comment.form.cancel }));

    expect(queryCollapsedBar()).toBeInTheDocument();
    expect(useUnsavedChangesStore.getState().dirtyKeys.has(UNSAVED_KEY)).toBe(false);

    // 버린 글은 넓은 화면으로 가도 되살아나지 않는다
    viewport.resizeTo('wide');

    expect(getInput()).toHaveValue('');
  });

  // 넓은 화면에서 등록하면 입력칸을 바로 비운다. 그 직후 좁아지면 접힌 바가 되는데, 요청이 실패해 글이
  // 되돌아오면 그 글이 접힌 바 뒤에 숨지 않게 시트가 펼쳐져야 한다. 떼어졌다 다시 붙은 입력칸에
  // react-hook-form이 값을 채워 주는지도 여기서 본다
  it('등록 직후 좁아졌다가 실패하면, 되돌아온 글이 펼친 시트에 보인다', async () => {
    let failRequest: () => void = () => {};

    server.use(
      http.post(`${API_BASE_URL}${API_ENDPOINTS.post.postComment(POST_ID)}`, async () => {
        await new Promise<void>((resolve) => {
          failRequest = resolve;
        });

        return HttpResponse.json({}, { status: 500 });
      })
    );

    const viewport = stubViewport('wide');
    const user = userEvent.setup();

    // 제출은 계정 조회가 끝나야 실제로 나간다(useCreateComment.test.tsx의 renderLoggedIn과 같은 이유)
    useAuthStore.getState().setAuth('test-access-token');

    const { queryClient } = renderCommentComposer();

    await waitFor(() => expect(queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));

    await user.type(getInput(), '실패할 댓글');
    // 버튼 이름에 단축키 힌트(Kbd)가 붙어 정규식으로 찾는다(CommentForm.test.tsx와 같은 방식)
    await user.click(
      screen.getByRole('button', { name: new RegExp(TEXTS.comment.form.submitComment) })
    );
    await waitFor(() => expect(getInput()).toHaveValue(''));

    viewport.resizeTo('narrow');
    expect(queryCollapsedBar()).toBeInTheDocument();

    failRequest();

    await waitFor(() => expect(queryInput()).toHaveValue('실패할 댓글'));
    expect(queryCollapsedBar()).not.toBeInTheDocument();
    expect(screen.getByText(TEXTS.messages.error.commentSubmit.createFailed)).toBeInTheDocument();
  });

  // 응답을 기다리는 동안 다음 댓글을 쓰기 시작했다면 그 글도 쓰던 글이다. 등록이 성공해도 시트를 접지 않는다 -
  // 접으면 그 글이 접힌 바 뒤에 숨는다. 새로 쓴 글이 없으면 지금처럼 접는다
  it('등록에 성공하면 접히지만, 응답을 기다리며 새로 쓴 글이 있으면 펼친 채 남는다', async () => {
    let respond: () => void = () => {};

    server.use(
      http.post(`${API_BASE_URL}${API_ENDPOINTS.post.postComment(POST_ID)}`, async () => {
        await new Promise<void>((resolve) => {
          respond = resolve;
        });
        // 응답을 돌려주지 않으면 기본 핸들러(등록 성공)가 이어 받는다
      })
    );

    stubViewport('narrow');
    const user = userEvent.setup();

    useAuthStore.getState().setAuth('test-access-token');

    const { queryClient } = renderCommentComposer();

    await waitFor(() => expect(queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));

    const submitName = new RegExp(TEXTS.comment.form.submitComment);

    // 1) 새로 쓴 글 없이 성공하면 접힌다
    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));
    await user.type(getInput(), '첫 댓글');
    await user.click(screen.getByRole('button', { name: submitName }));
    await waitFor(() => expect(getInput()).toHaveValue(''));

    respond();

    await waitFor(() => expect(queryCollapsedBar()).toBeInTheDocument());

    // 2) 응답을 기다리며 다음 글을 쓰기 시작했으면 성공해도 그 글이 펼친 시트에 남는다
    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));
    await user.type(getInput(), '둘째 댓글');
    await user.click(screen.getByRole('button', { name: submitName }));
    await waitFor(() => expect(getInput()).toHaveValue(''));
    await user.type(getInput(), '기다리며 쓴 글');

    const typingInput = getInput();
    const pendingRequests = queryClient.isMutating();

    respond();

    await waitFor(() => expect(queryClient.isMutating()).toBeLessThan(pendingRequests));
    expect(getInput()).toHaveValue('기다리며 쓴 글');
    expect(queryCollapsedBar()).not.toBeInTheDocument();
    // 쓰던 입력칸이 포커스를 쥔 채 그대로다 - 접힌 화면이 한 번이라도 그려지면 입력칸이 새로 만들어져 포커스가 빠진다
    expect(getInput()).toBe(typingInput);
    expect(typingInput).toHaveFocus();
  });

  // 쓰던 글 때문에 저절로 펼쳐진 시트도 눌러 펼친 시트와 같은 때(취소·등록 성공)에만 접힌다. 글 유무만 보고
  // 접으면 글을 지우는 순간 입력칸이 사라진다
  it('폭이 바뀌어 펼쳐진 시트는 글을 다 지워도 접히지 않는다', async () => {
    const viewport = stubViewport('wide');
    const user = userEvent.setup();

    renderCommentComposer();

    await user.type(getInput(), '넓은 화면에서 쓴 글');
    viewport.resizeTo('narrow');

    const input = getInput();

    await user.clear(input);

    expect(getInput()).toBe(input);
    expect(input).toHaveFocus();
    expect(queryCollapsedBar()).not.toBeInTheDocument();
  });

  it('폭이 바뀌어 펼쳐진 시트에서 등록하면 응답을 기다리는 동안 펼친 채이고, 성공하면 접힌다', async () => {
    let respond: () => void = () => {};

    server.use(
      http.post(`${API_BASE_URL}${API_ENDPOINTS.post.postComment(POST_ID)}`, async () => {
        await new Promise<void>((resolve) => {
          respond = resolve;
        });
        // 응답을 돌려주지 않으면 기본 핸들러(등록 성공)가 이어 받는다
      })
    );

    const viewport = stubViewport('wide');
    const user = userEvent.setup();

    useAuthStore.getState().setAuth('test-access-token');

    const { queryClient } = renderCommentComposer();

    await waitFor(() => expect(queryClient.getQueryData(accountKeys.root)).toEqual(mockAccount));

    await user.type(getInput(), '넓은 화면에서 쓴 글');
    viewport.resizeTo('narrow');

    await user.click(
      screen.getByRole('button', { name: new RegExp(TEXTS.comment.form.submitComment) })
    );
    await waitFor(() => expect(queryClient.isMutating()).toBe(1));

    expect(getInput()).toHaveValue('');
    expect(queryCollapsedBar()).not.toBeInTheDocument();

    respond();

    await waitFor(() => expect(queryCollapsedBar()).toBeInTheDocument());
    expect(queryInput()).not.toBeInTheDocument();
  });
});

describe('CommentComposer — 바깥에서 주는 포커스(#comments)', () => {
  it('넓은 화면에서는 입력칸에 포커스를 준다', () => {
    stubViewport('wide');
    const ref = createRef<CommentFormHandle>();
    renderCommentComposer(ref);

    act(() => ref.current?.focus());

    expect(getInput()).toHaveFocus();
  });

  it('좁은 화면에서 접혀 있으면 줄 곳이 없다 - 바는 접힌 채로 둔다', () => {
    stubViewport('narrow');
    const ref = createRef<CommentFormHandle>();
    renderCommentComposer(ref);

    expect(ref.current).toBeNull();
    expect(queryCollapsedBar()).toBeInTheDocument();
  });

  // 좁은 화면은 전부터 이 포커스를 받지 않았다(폼이 접힌 바 안에 따로 있었다). 시트가 펼쳐져 있다고 받기
  // 시작하면, 쓰던 글을 둔 채 카드의 댓글 아이콘을 누를 때 시트 입력칸으로 포커스가 옮겨 간다
  it('좁은 화면에서는 시트가 펼쳐져 있어도 받지 않는다', async () => {
    stubViewport('narrow');
    const user = userEvent.setup();
    const ref = createRef<CommentFormHandle>();
    renderCommentComposer(ref);

    await user.click(screen.getByRole('button', { name: TEXTS.ariaLabels.commentBarExpand }));

    expect(getInput()).toBeInTheDocument();
    expect(ref.current).toBeNull();
  });
});
