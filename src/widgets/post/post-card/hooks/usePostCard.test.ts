import { describe, it, expect, vi, beforeEach, afterEach, type MockInstance } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { createElement, type MouseEvent, type ReactNode } from 'react';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from '@/shared/lib/toast/toast';
import { http } from '@/mocks/http';
import { server } from '@/mocks/server';
import { MockEnvelopeUtil } from '@/mocks/mock-envelope.util';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockAccount, mockOtherAccount } from '@/mocks/fixtures/account.fixtures';
import { createTestQueryClient } from '@/test/utils';
import { accountKeys } from '@/entities/account/api/account.keys';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { postKeys } from '@/entities/post/api/post.keys';
import { useUpdatePostMutation } from '@/entities/post/api/post.queries';
import type { Account } from '@/entities/account/model/account.schema';
import type { Post } from '@/entities/post/model/post.schema';
import { useAlertDialogStore } from '@/shared/ui/elements/dialog/alert-dialog/alertDialog.store';
import { TEXTS } from '@/shared/config/texts';
import { MUTATION_PROGRESS_DELAY_MS } from '@/shared/config/const';
import { usePostCard } from '@/widgets/post/post-card/hooks/usePostCard';

const POST_ID = mockPost.id;

interface SetupOptions {
  post?: Post;
  isDetail?: boolean;
  account?: Account | null;
  path?: string;
}

function setup({
  post = mockPost,
  isDetail,
  account = mockAccount,
  path = '/post',
}: SetupOptions = {}) {
  const queryClient: QueryClient = createTestQueryClient({ gcTime: Infinity });

  if (account) {
    queryClient.setQueryData(accountKeys.root, account);
  }

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(
      QueryClientProvider,
      { client: queryClient },
      createElement(MemoryRouter, { initialEntries: [path] }, children)
    );

  const hook = renderHook(
    () => ({
      card: usePostCard(post, isDetail),
      location: useLocation(),
      update: useUpdatePostMutation(post.id),
      otherUpdate: useUpdatePostMutation('other-post-id'),
    }),
    { wrapper }
  );

  return { ...hook, queryClient };
}

function createEvent() {
  const event = { preventDefault: vi.fn(), stopPropagation: vi.fn() };

  return { event, mouseEvent: event as unknown as MouseEvent };
}

function createGate() {
  let open: () => void = () => {};
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });

  return { promise, open };
}

function postWithComments(commentCount: number): Post {
  return { ...mockPost, stats: { ...mockPost.stats, commentCount } };
}

function lastDialog() {
  const dialog = useAlertDialogStore.getState().dialogs.at(-1);

  if (!dialog) {
    throw new Error('열린 확인창이 없다');
  }

  return dialog;
}

beforeEach(() => {
  useAlertDialogStore.setState({ dialogs: [] });
});

describe('usePostCard - 초기 상태', () => {
  it('AI 요약과 메뉴는 닫힌 채로 시작하고 setter로 열 수 있다', () => {
    const { result } = setup();

    expect(result.current.card.isAiSummaryExpanded).toBe(false);
    expect(result.current.card.isMenuOpen).toBe(false);

    act(() => {
      result.current.card.setIsAiSummaryExpanded(true);
      result.current.card.setIsMenuOpen(true);
    });

    expect(result.current.card.isAiSummaryExpanded).toBe(true);
    expect(result.current.card.isMenuOpen).toBe(true);
  });
});

describe('usePostCard - 작성자 판정', () => {
  it('내 글이면 isOwner가 true다', () => {
    const { result } = setup({ account: mockAccount });

    expect(result.current.card.isOwner).toBe(true);
  });

  it('다른 사람의 글이면 isOwner가 false다', () => {
    const { result } = setup({ account: mockOtherAccount });

    expect(result.current.card.isOwner).toBe(false);
  });

  it('로그인하지 않았으면 isOwner가 false다', () => {
    const { result } = setup({ account: null });

    expect(result.current.card.isOwner).toBe(false);
  });
});

describe('usePostCard - 수정 진행 표시', () => {
  it('수정 요청이 없으면 isUpdating이 false다', () => {
    const { result } = setup();

    expect(result.current.card.isUpdating).toBe(false);
  });

  it('이 글의 수정이 오래 걸리면 지연 뒤에 true가 되고, 끝나면 false로 돌아온다', async () => {
    const gate = createGate();
    server.use(
      http.patch('/post/{id}', async ({ params }) => {
        await gate.promise;

        return MockEnvelopeUtil.json({ ...mockPost, id: params.id });
      })
    );
    const { result } = setup();

    act(() => {
      result.current.update.mutate({ url: mockPost.url, title: '', isPrivate: false });
    });

    // 빠른 수정은 깜빡임을 막으려고 곧바로 표시하지 않는다
    expect(result.current.card.isUpdating).toBe(false);

    await waitFor(() => expect(result.current.card.isUpdating).toBe(true));

    gate.open();

    await waitFor(() => expect(result.current.card.isUpdating).toBe(false), { timeout: 3000 });
  });

  it('다른 글의 수정이 진행 중이어도 이 카드는 수정 중으로 표시하지 않는다', async () => {
    const gate = createGate();
    server.use(
      http.patch('/post/{id}', async ({ params }) => {
        await gate.promise;

        return MockEnvelopeUtil.json({ ...mockPost, id: params.id });
      })
    );
    const { result } = setup();

    act(() => {
      result.current.otherUpdate.mutate({ url: mockPost.url, title: '', isPrivate: false });
    });

    await waitFor(() => expect(result.current.otherUpdate.isPending).toBe(true));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, MUTATION_PROGRESS_DELAY_MS + 100));
    });

    expect(result.current.card.isUpdating).toBe(false);

    gate.open();

    await waitFor(() => expect(result.current.otherUpdate.isPending).toBe(false));
  });
});

describe('usePostCard - 삭제', () => {
  it('삭제를 누르면 기본 동작을 막고 확인창을 연다', () => {
    const { result } = setup();
    const { event, mouseEvent } = createEvent();

    act(() => {
      result.current.card.handleDelete(mouseEvent);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(useAlertDialogStore.getState().dialogs).toHaveLength(1);
    expect(lastDialog().message).toBe(TEXTS.messages.warning.postDeleteConfirm);
  });

  it('목록에서 삭제를 확정하면 글을 지우고 메뉴를 닫되 화면은 옮기지 않는다', async () => {
    const deletedIds: string[] = [];
    server.use(
      http.delete('/post/{id}', ({ params }) => {
        deletedIds.push(params.id);

        return MockEnvelopeUtil.unit();
      })
    );
    const { result } = setup({ path: `/post/${POST_ID}` });
    const { mouseEvent } = createEvent();

    act(() => {
      result.current.card.setIsMenuOpen(true);
    });
    act(() => {
      result.current.card.handleDelete(mouseEvent);
    });
    await act(async () => {
      await lastDialog().onConfirm?.();
    });

    await waitFor(() => expect(result.current.card.isMenuOpen).toBe(false));
    expect(deletedIds).toEqual([POST_ID]);
    expect(result.current.location.pathname).toBe(`/post/${POST_ID}`);
  });

  it('상세에서 삭제를 확정하면 글 목록으로 이동한다', async () => {
    const { result } = setup({ isDetail: true, path: `/post/${POST_ID}` });
    const { mouseEvent } = createEvent();

    act(() => {
      result.current.card.handleDelete(mouseEvent);
    });
    await act(async () => {
      await lastDialog().onConfirm?.();
    });

    await waitFor(() => expect(result.current.location.pathname).toBe('/post'));
  });
});

describe('usePostCard - 공개 설정 전환', () => {
  it('내 글이 아니면 확인창을 열지 않는다', () => {
    const { result } = setup({ account: mockOtherAccount });
    const { event, mouseEvent } = createEvent();

    act(() => {
      result.current.card.handleToggleVisibility(mouseEvent);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(useAlertDialogStore.getState().dialogs).toHaveLength(0);
  });

  it('공개 글은 나만 보기로 바꾸는 확인창을 연다', () => {
    const { result } = setup({ post: { ...mockPost, isPrivate: false } });
    const { event, mouseEvent } = createEvent();

    act(() => {
      result.current.card.handleToggleVisibility(mouseEvent);
    });

    const dialog = lastDialog();
    expect(event.preventDefault).toHaveBeenCalled();
    expect(dialog.title).toBe(TEXTS.post.card.visibilityConfirmTitle);
    expect(dialog.message).toBe(
      TEXTS.post.card.visibilityConfirmMessage(TEXTS.post.card.visibilityToPrivate)
    );
    expect(dialog.confirmText).toBe(TEXTS.post.card.visibilityConfirmButtonToPrivate);
    expect(dialog.cancelText).toBe(TEXTS.buttons.cancel);
    expect(dialog.emphasis).toBe('confirm');
  });

  it('비공개 글은 전체 공개로 바꾸는 확인창을 연다', () => {
    const { result } = setup({ post: { ...mockPost, isPrivate: true } });
    const { mouseEvent } = createEvent();

    act(() => {
      result.current.card.handleToggleVisibility(mouseEvent);
    });

    const dialog = lastDialog();
    expect(dialog.message).toBe(
      TEXTS.post.card.visibilityConfirmMessage(TEXTS.post.card.visibilityToPublic)
    );
    expect(dialog.confirmText).toBe(TEXTS.post.card.visibilityConfirmButtonToPublic);
  });

  it.each([
    { isPrivate: false, expected: true },
    { isPrivate: true, expected: false },
  ])(
    'isPrivate=$isPrivate인 글을 확정하면 $expected로 요청하고, 진행 중에 표시했다가 끝나면 메뉴를 닫는다',
    async ({ isPrivate, expected }) => {
      const gate = createGate();
      const bodies: unknown[] = [];
      server.use(
        http.patch('/post/{id}/visibility', async ({ request, params }) => {
          bodies.push(await request.clone().json());
          await gate.promise;

          return MockEnvelopeUtil.json({ ...mockPost, id: params.id, isPrivate: expected });
        })
      );
      const { result } = setup({ post: { ...mockPost, isPrivate } });
      const { mouseEvent } = createEvent();

      act(() => {
        result.current.card.setIsMenuOpen(true);
      });
      act(() => {
        result.current.card.handleToggleVisibility(mouseEvent);
      });
      act(() => {
        lastDialog().onConfirm?.();
      });

      await waitFor(() => expect(result.current.card.isUpdatingVisibility).toBe(true));
      expect(result.current.card.isMenuOpen).toBe(true);

      gate.open();

      await waitFor(() => expect(result.current.card.isMenuOpen).toBe(false));
      expect(bodies).toEqual([{ isPrivate: expected }]);
      expect(result.current.card.isUpdatingVisibility).toBe(false);
    }
  );
});

describe('usePostCard - 링크 복사', () => {
  const originalUrl = `${window.location.origin}/post/${POST_ID}`;
  let userAgentSpy: MockInstance<() => string>;

  function setUserAgent(userAgent: string) {
    userAgentSpy.mockReturnValue(userAgent);
  }

  function setShare(share: unknown) {
    Object.defineProperty(navigator, 'share', { value: share, configurable: true });
  }

  beforeEach(() => {
    userAgentSpy = vi.spyOn(navigator, 'userAgent', 'get');
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X) Chrome/120');
    vi.mocked(navigator.clipboard.writeText).mockReset().mockResolvedValue(undefined);
    vi.spyOn(toast, 'success').mockImplementation(() => 'id');
    vi.spyOn(toast, 'error').mockImplementation(() => 'id');
  });

  afterEach(() => {
    userAgentSpy.mockRestore();
    Reflect.deleteProperty(navigator, 'share');
    vi.restoreAllMocks();
  });

  it('데스크톱에서는 글 주소를 클립보드에 복사하고 안내한다', async () => {
    const { result } = setup();

    await act(async () => {
      await result.current.card.handleCopyLink();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(originalUrl);
    expect(toast.success).toHaveBeenCalledWith(TEXTS.messages.success.linkCopied);
  });

  it('데스크톱에서는 공유 기능이 있어도 클립보드를 쓴다', async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    setShare(share);
    const { result } = setup();

    await act(async () => {
      await result.current.card.handleCopyLink();
    });

    expect(share).not.toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(originalUrl);
  });

  it.each([
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    'Mozilla/5.0 (Linux; Android 14; Pixel 8)',
  ])(
    '모바일(%s)에서 공유 기능이 있으면 공유 시트로 주소를 넘기고 안내는 띄우지 않는다',
    async (ua) => {
      setUserAgent(ua);
      const share = vi.fn().mockResolvedValue(undefined);
      setShare(share);
      const { result } = setup();

      await act(async () => {
        await result.current.card.handleCopyLink();
      });

      expect(share).toHaveBeenCalledWith({ url: originalUrl });
      expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
      expect(toast.success).not.toHaveBeenCalled();
    }
  );

  it('모바일이어도 공유 기능이 없으면 클립보드에 복사하되 안내는 띄우지 않는다', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const { result } = setup();

    await act(async () => {
      await result.current.card.handleCopyLink();
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(originalUrl);
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('사용자가 공유 시트를 닫은 것은 실패로 알리지 않는다', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setShare(
      vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' }))
    );
    const { result } = setup();

    await act(async () => {
      await result.current.card.handleCopyLink();
    });

    expect(toast.error).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it('공유가 다른 이유로 실패하면 실패를 알리고 원인을 기록한다', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const failure = Object.assign(new Error('denied'), { name: 'NotAllowedError' });
    setShare(vi.fn().mockRejectedValue(failure));
    const { result } = setup();

    await act(async () => {
      await result.current.card.handleCopyLink();
    });

    expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.linkCopyFailed);
    expect(consoleError).toHaveBeenCalledWith(expect.any(String), failure);
  });

  it('클립보드 복사가 실패하면 성공 안내 없이 실패를 알린다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('blocked'));
    const { result } = setup();

    await act(async () => {
      await result.current.card.handleCopyLink();
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.linkCopyFailed);
  });
});

describe('usePostCard - 원본 링크 복사', () => {
  beforeEach(() => {
    vi.mocked(navigator.clipboard.writeText).mockReset().mockResolvedValue(undefined);
    vi.spyOn(toast, 'success').mockImplementation(() => 'id');
    vi.spyOn(toast, 'error').mockImplementation(() => 'id');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('원본 주소를 복사하고 안내하며, 카드 클릭으로 번지지 않게 이벤트를 막는다', async () => {
    const { result } = setup();
    const { event, mouseEvent } = createEvent();

    await act(async () => {
      await result.current.card.handleCopyOriginalUrl(mouseEvent);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.stopPropagation).toHaveBeenCalled();
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockPost.url);
    expect(toast.success).toHaveBeenCalledWith(TEXTS.messages.success.originalLinkCopied);
  });

  it('복사에 실패하면 실패를 알리고 성공 안내는 띄우지 않는다', async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValueOnce(new Error('blocked'));
    const { result } = setup();
    const { mouseEvent } = createEvent();

    await act(async () => {
      await result.current.card.handleCopyOriginalUrl(mouseEvent);
    });

    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(TEXTS.messages.error.linkCopyFailed);
  });
});

describe('usePostCard - 수정 화면 이동', () => {
  it('메뉴를 닫고 이 글의 수정 화면으로 이동한다', () => {
    const { result } = setup();

    act(() => {
      result.current.card.setIsMenuOpen(true);
    });
    act(() => {
      result.current.card.handleNavigateToEdit();
    });

    expect(result.current.card.isMenuOpen).toBe(false);
    expect(result.current.location.pathname).toBe(`/post/edit/${POST_ID}`);
  });
});

describe('usePostCard - 미리 받기', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('handlePrefetchDetail', () => {
    it('게시글은 바로 받고 댓글은 100ms 머문 뒤에 받는다', () => {
      const { result, queryClient } = setup({ post: postWithComments(3) });

      act(() => {
        result.current.card.handlePrefetchDetail();
      });

      expect(queryClient.getQueryState(postKeys.detail(POST_ID))).toBeDefined();
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))).toBeUndefined();

      act(() => {
        vi.advanceTimersByTime(99);
      });
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))).toBeUndefined();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))?.fetchStatus).toBe('fetching');
    });

    it('다시 올라가면 머문 시간을 처음부터 센다', () => {
      const { result, queryClient } = setup({ post: postWithComments(3) });

      act(() => {
        result.current.card.handlePrefetchDetail();
      });
      act(() => {
        vi.advanceTimersByTime(60);
      });
      act(() => {
        result.current.card.handlePrefetchDetail();
      });
      act(() => {
        vi.advanceTimersByTime(60);
      });

      expect(queryClient.getQueryState(commentKeys.list(POST_ID))).toBeUndefined();

      act(() => {
        vi.advanceTimersByTime(40);
      });
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))).toBeDefined();
    });

    it('머물기를 취소하면 댓글을 받지 않는다', () => {
      const { result, queryClient } = setup({ post: postWithComments(3) });

      act(() => {
        result.current.card.handlePrefetchDetail();
      });
      act(() => {
        vi.advanceTimersByTime(50);
      });
      act(() => {
        result.current.card.handleCancelPrefetchComments();
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(queryClient.getQueryState(postKeys.detail(POST_ID))).toBeDefined();
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))).toBeUndefined();
    });

    it('머무는 중에 카드가 사라지면 댓글을 받지 않는다', () => {
      const { result, queryClient, unmount } = setup({ post: postWithComments(3) });

      act(() => {
        result.current.card.handlePrefetchDetail();
      });
      unmount();
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(queryClient.getQueryState(commentKeys.list(POST_ID))).toBeUndefined();
    });

    it('댓글이 0개인 글은 머물기를 기다리지 않고 빈 댓글 목록을 심는다', () => {
      const { result, queryClient } = setup({ post: postWithComments(0) });

      act(() => {
        result.current.card.handlePrefetchDetail();
      });

      expect(queryClient.getQueryState(postKeys.detail(POST_ID))).toBeDefined();
      expect(queryClient.getQueryData(commentKeys.list(POST_ID))).toEqual([]);

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))?.fetchStatus).toBe('idle');
    });

    it('상세 안에서는 게시글만 받고 댓글은 받지도 심지도 않는다', () => {
      const { result, queryClient } = setup({ post: postWithComments(3), isDetail: true });
      const empty = setup({ post: postWithComments(0), isDetail: true });

      act(() => {
        result.current.card.handlePrefetchDetail();
        empty.result.current.card.handlePrefetchDetail();
      });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(queryClient.getQueryState(postKeys.detail(POST_ID))).toBeDefined();
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))).toBeUndefined();
      expect(empty.queryClient.getQueryState(commentKeys.list(POST_ID))).toBeUndefined();
    });
  });

  describe('handlePrefetchDetailWithComments', () => {
    it('게시글과 댓글을 기다림 없이 바로 받는다', () => {
      const { result, queryClient } = setup({ post: postWithComments(3) });

      act(() => {
        result.current.card.handlePrefetchDetailWithComments();
      });

      expect(queryClient.getQueryState(postKeys.detail(POST_ID))).toBeDefined();
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))?.fetchStatus).toBe('fetching');
    });

    it('댓글이 0개인 글은 요청 대신 빈 댓글 목록을 심는다', () => {
      const { result, queryClient } = setup({ post: postWithComments(0) });

      act(() => {
        result.current.card.handlePrefetchDetailWithComments();
      });

      expect(queryClient.getQueryState(postKeys.detail(POST_ID))).toBeDefined();
      expect(queryClient.getQueryData(commentKeys.list(POST_ID))).toEqual([]);
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))?.fetchStatus).toBe('idle');
    });
  });
});

describe('usePostCard - 카테고리 선택', () => {
  it('피드에서는 검색어를 그 카테고리로 바꾸고 다른 파라미터는 유지한다', () => {
    const { result } = setup({ path: '/post?filter=mine&q=old' });

    act(() => {
      result.current.card.handleCategoryClick('Frontend');
    });

    const params = new URLSearchParams(result.current.location.search);
    expect(result.current.location.pathname).toBe('/post');
    expect(params.get('q')).toBe('@Frontend');
    expect(params.get('filter')).toBe('mine');
  });

  it('같은 카테고리를 다시 눌러도 필터가 풀리지 않는다', () => {
    const { result } = setup({ path: '/post?q=%40Frontend' });

    act(() => {
      result.current.card.handleCategoryClick('Frontend');
    });

    expect(new URLSearchParams(result.current.location.search).get('q')).toBe('@Frontend');
  });

  it('피드가 아닌 곳에서는 그 페이지의 파라미터를 가져가지 않고 피드로 이동한다', () => {
    const { result } = setup({ path: '/bookmark?folder=abc' });

    act(() => {
      result.current.card.handleCategoryClick('C# 개발');
    });

    const params = new URLSearchParams(result.current.location.search);
    expect(result.current.location.pathname).toBe('/post');
    expect(params.get('q')).toBe('@C# 개발');
    expect(params.has('folder')).toBe(false);
  });

  it('상세에서 누르면 피드로 이동한다', () => {
    const { result } = setup({ path: `/post/${POST_ID}` });

    act(() => {
      result.current.card.handleCategoryClick('Frontend');
    });

    expect(result.current.location.pathname).toBe('/post');
    expect(new URLSearchParams(result.current.location.search).get('q')).toBe('@Frontend');
  });
});
