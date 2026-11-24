import { describe, it, expect, beforeEach, vi } from 'vitest';
import { http, HttpResponse } from 'msw';
import type { QueryClient } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import {
  renderWithProviders,
  renderWithDataRouter,
  createTestQueryClient,
  screen,
  waitFor,
  act,
  fireEvent,
} from '@/test/utils';
import type { Comment } from '@/entities/comment/model/comment.dto';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { COMMENT_SECTION_HASH } from '@/entities/comment/config/comment.const';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { seedEmptyComments } from '@/entities/comment/api/comment.queries';
import { TooltipProvider } from '@baechan/ui/atoms/tooltip';
import { CommentList } from '@/widgets/comment/comment-list/ui/CommentList';

const POST_ID = mockPost.id;
const COMMENT_ENTRY = `/post/${POST_ID}#comment-${mockComment.id}`;
const COMMENT_SECTION_ENTRY = `/post/${POST_ID}${COMMENT_SECTION_HASH}`;

// renderWithProviders에는 TooltipProvider가 없다(CommentForm.test.tsx와 같은 이유)
function renderCommentList(queryClient: QueryClient, entry = COMMENT_ENTRY, commentCount = 0) {
  return renderWithProviders(
    <TooltipProvider>
      <CommentList postId={POST_ID} postAuthorId={mockPost.author.id} commentCount={commentCount} />
    </TooltipProvider>,
    { wrapperOptions: { queryClient, initialEntries: [entry] } }
  );
}

const findSkeleton = () => document.querySelector('[aria-busy="true"]');

/** release()를 부를 때까지 댓글 응답을 붙잡아 둔다 */
function holdCommentResponse(comments = [mockComment]) {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });

  server.use(
    http.get(`${API_BASE_URL}${API_ENDPOINTS.post.postComment(POST_ID)}`, async () => {
      await released;

      return HttpResponse.json({ status: 200, message: 'ok', data: comments, timestamp: '' });
    })
  );

  return { release: () => release() };
}

describe('CommentList 해시 이동', () => {
  const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);

  beforeEach(() => {
    scrollIntoView.mockClear();
  });

  it('심어 둔 빈 목록으로 먼저 그려졌으면 댓글이 도착한 뒤 그 댓글로 스크롤한다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    const { release } = holdCommentResponse();
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient);

    expect(screen.getByText(TEXTS.comment.list.empty)).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();

    release();

    expect(await screen.findByText(mockComment.content)).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.querySelector(`#comment-${mockComment.id}`)
    );
  });

  it('이미 스크롤한 뒤에는 댓글 수가 바뀌어도 다시 끌어오지 않는다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity, staleTime: Infinity });
    queryClient.setQueryData(commentKeys.list(POST_ID), [mockComment]);

    renderCommentList(queryClient);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    act(() => {
      queryClient.setQueryData(commentKeys.list(POST_ID), [
        { ...mockComment, id: 'comment-uuid-2', content: '새로 달린 댓글' },
        mockComment,
      ]);
    });

    expect(await screen.findByText('새로 달린 댓글')).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('심어 둔 빈 목록이면 폼으로 먼저 스크롤하고, 댓글이 도착하면 문서가 길어졌으니 한 번 더 맞춘다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    const { release } = holdCommentResponse();
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_SECTION_ENTRY);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    release();

    expect(await screen.findByText(mockComment.content)).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(2));
    expect(scrollIntoView.mock.contexts[1]).toBe(scrollIntoView.mock.contexts[0]);
  });

  it('다시 받아도 정말 빈 글이면 다시 맞추지 않고, 그 뒤 첫 댓글이 달려도 끌어오지 않는다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    const { release } = holdCommentResponse([]);
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_SECTION_ENTRY);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    release();

    await waitFor(() =>
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))?.dataUpdatedAt).toBeGreaterThan(0)
    );

    act(() => {
      queryClient.setQueryData(commentKeys.list(POST_ID), [mockComment]);
    });

    expect(await screen.findByText(mockComment.content)).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it('뼈대로 기다리는 중이어도 제목 숫자와 도착한 댓글 수가 같을 때 그 댓글로 스크롤한다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    const { release } = holdCommentResponse();
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_ENTRY, 1);

    expect(findSkeleton()).toBeInTheDocument();
    expect(scrollIntoView).not.toHaveBeenCalled();

    release();

    expect(await screen.findByText(mockComment.content)).toBeInTheDocument();
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.querySelector(`#comment-${mockComment.id}`)
    );
  });

  it('뼈대로 자리를 잡았으면 폼으로 한 번만 스크롤하고, 댓글이 도착해도 다시 끌어오지 않는다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    const { release } = holdCommentResponse();
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_SECTION_ENTRY, 1);

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));

    release();

    expect(await screen.findByText(mockComment.content)).toBeInTheDocument();
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

describe('CommentList 심어 둔 빈 목록을 다시 받는 동안', () => {
  it('상세 숫자가 0보다 크면 제목에 그 숫자를 보여 주고 빈 안내 대신 숨긴 뼈대로 자리를 잡았다가, 0.5초 뒤 드러낸다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    const { release } = holdCommentResponse();
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_SECTION_ENTRY, 3);

    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      `${TEXTS.comment.list.heading}3`
    );
    expect(screen.queryByText(TEXTS.comment.list.empty)).not.toBeInTheDocument();

    const skeleton = findSkeleton();
    expect(skeleton).toHaveClass('invisible');
    expect(skeleton?.children).toHaveLength(3);

    await waitFor(() => expect(skeleton).not.toHaveClass('invisible'), { timeout: 2000 });

    release();

    expect(await screen.findByText(mockComment.content)).toBeInTheDocument();
    expect(findSkeleton()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      `${TEXTS.comment.list.heading}1`
    );
  });

  it('댓글이 아주 많아도 뼈대는 10개까지만 그린다', () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    holdCommentResponse();
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_SECTION_ENTRY, 500);

    expect(findSkeleton()?.children).toHaveLength(10);
  });

  it('상세 숫자가 0이면 뼈대 없이 빈 안내를 바로 보여 준다', () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    holdCommentResponse([]);
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_SECTION_ENTRY, 0);

    expect(screen.getByText(TEXTS.comment.list.empty)).toBeInTheDocument();
    expect(findSkeleton()).not.toBeInTheDocument();
  });

  it('상세 숫자가 옛값이고 받아 보니 빈 목록이면 빈 안내와 0으로 바뀐다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    const { release } = holdCommentResponse([]);
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_SECTION_ENTRY, 3);

    release();

    expect(await screen.findByText(TEXTS.comment.list.empty)).toBeInTheDocument();
    expect(findSkeleton()).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent(
      `${TEXTS.comment.list.heading}0`
    );
  });

  it('다시 받기가 실패하면 뼈대에 멈추지 않고 빈 안내로 돌아간다', async () => {
    const queryClient = createTestQueryClient({ gcTime: Infinity });
    server.use(
      http.get(`${API_BASE_URL}${API_ENDPOINTS.post.postComment(POST_ID)}`, () =>
        HttpResponse.json(
          { status: 500, message: 'error', data: null, timestamp: '' },
          { status: 500 }
        )
      )
    );
    seedEmptyComments(queryClient, POST_ID);

    renderCommentList(queryClient, COMMENT_SECTION_ENTRY, 3);

    expect(await screen.findByText(TEXTS.comment.list.empty)).toBeInTheDocument();
    expect(findSkeleton()).not.toBeInTheDocument();
  });
});

describe('CommentList 우리 글 링크', () => {
  const LINKED_POST_ID = '3eedb318-1c2d-4e5f-8a9b-0c1d2e3f4a5b';
  const OUR_POST_URL = `${window.location.origin}/post/${LINKED_POST_ID}`;
  const EXTERNAL_URL = 'https://example.com/article';

  function linkingComment(id: string, url: string, title: string): Comment {
    return {
      ...mockComment,
      id,
      content: `참고 ${url}`,
      linkMetadata: { url, title, description: null, ogImage: null },
    };
  }

  function renderWithComments(comments: Comment[], entry = `/post/${POST_ID}`) {
    server.use(
      http.get(`${API_BASE_URL}${API_ENDPOINTS.post.postComment(POST_ID)}`, () =>
        HttpResponse.json({ status: 200, message: 'ok', data: comments, timestamp: '' })
      )
    );

    return renderWithDataRouter(
      <TooltipProvider>
        <CommentList postId={POST_ID} postAuthorId={mockPost.author.id} commentCount={0} />
      </TooltipProvider>,
      { wrapperOptions: { initialEntries: [entry] } }
    );
  }

  it('우리 글 카드는 새 탭 없이 앱 안에서 그 글로 이동한다', async () => {
    const { router } = renderWithComments([
      linkingComment('comment-uuid-2', OUR_POST_URL, '링크된 우리 글'),
    ]);

    const card = await screen.findByRole('link', { name: /링크된 우리 글/ });
    expect(card).toHaveAttribute('href', `/post/${LINKED_POST_ID}`);
    expect(card).not.toHaveAttribute('target');

    fireEvent.click(card);

    await waitFor(() => expect(router.state.location.pathname).toBe(`/post/${LINKED_POST_ID}`));
  });

  it('본문의 우리 글 주소도 앱 안 경로로 그린다', async () => {
    renderWithComments([linkingComment('comment-uuid-2', OUR_POST_URL, '링크된 우리 글')]);

    const bodyLink = await screen.findByRole('link', { name: OUR_POST_URL });
    expect(bodyLink).toHaveAttribute('href', `/post/${LINKED_POST_ID}`);
    expect(bodyLink).not.toHaveAttribute('target');
  });

  it('다른 사이트 카드는 지금처럼 새 탭으로 연다', async () => {
    renderWithComments([linkingComment('comment-uuid-2', EXTERNAL_URL, '외부 글')]);

    const card = await screen.findByRole('link', { name: /외부 글/ });
    expect(card).toHaveAttribute('href', EXTERNAL_URL);
    expect(card).toHaveAttribute('target', '_blank');
  });

  it('지금 글의 #댓글 주소를 누르면 페이지를 떠나지 않고 그 댓글로 스크롤한다', async () => {
    const scrollIntoView = vi.mocked(Element.prototype.scrollIntoView);
    scrollIntoView.mockClear();
    const hashUrl = `${window.location.origin}/post/${LINKED_POST_ID}#comment-${mockComment.id}`;
    const { router } = renderWithComments(
      [mockComment, linkingComment('comment-uuid-2', hashUrl, '같은 글의 댓글')],
      `/post/${LINKED_POST_ID}`
    );

    fireEvent.click(await screen.findByRole('link', { name: hashUrl }));

    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
    expect(scrollIntoView.mock.contexts[0]).toBe(
      document.getElementById(`comment-${mockComment.id}`)
    );
    expect(router.state.location.pathname).toBe(`/post/${LINKED_POST_ID}`);
  });
});
