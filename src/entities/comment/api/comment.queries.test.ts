import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { createElement, Suspense, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from 'react-error-boundary';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS, IDEMPOTENCY_KEY_HEADER } from '@/shared/config/api';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { createQueryClientWithErrorToasts, createTestQueryClient } from '@/test/utils';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockAccount, mockOtherAccount } from '@/mocks/fixtures/account.fixtures';
import type { Comment } from '@/entities/comment/model/comment.schema';
import {
  prefetchComments,
  seedEmptyComments,
  useCreateCommentMutation,
  useCreateReplyMutation,
  useSuspenseComments,
  useUpdateCommentMutation,
} from '@/entities/comment/api/comment.queries';

// 업로드 자체는 comment.api.test.ts가 본다 - 여기서는 키를 고르는 데 쓰는 파일 속성만 본다
vi.mock('@/shared/lib/upload/uploadImageAndGetUrl', () => ({
  uploadImageAndGetUrl: vi.fn(async (file: File) => `https://cdn.example.com/${file.name}`),
}));

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

// setQueryData로 캐시를 심고 나중에 getQueryData로 검증하므로 gcTime: Infinity가 필요하다
// (createTestQueryClient 참고).
let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const POST_ID = mockPost.id;
const AUTHOR = { id: mockAccount.id, nickname: mockAccount.nickname, image: null };

beforeEach(() => {
  sessionStorage.clear();
  queryClient = createTestQueryClient({ gcTime: Infinity });
  // 기본 commentHandlers는 API_BASE_URL 접두사(/api) 없이 등록돼 있어 테스트 환경
  // (VITE_API_BASE_URL) 요청 경로와 매칭되지 않는다 - url()로 명시 등록.
  server.use(
    http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
      HttpResponse.json(
        { status: 201, message: 'ok', data: mockComment, timestamp: new Date().toISOString() },
        { status: 201 }
      )
    ),
    http.post(url(API_ENDPOINTS.post.commentReply('parent-comment')), () =>
      HttpResponse.json(
        {
          status: 201,
          message: 'ok',
          data: { ...mockComment, id: 'reply-uuid-1' },
          timestamp: new Date().toISOString(),
        },
        { status: 201 }
      )
    )
  );
});

describe('useCreateCommentMutation', () => {
  it('제출 즉시 임시 댓글을 목록 맨 앞에 꽂는다 (서버 응답을 기다리지 않는다)', async () => {
    // 응답을 영원히 지연시켜 낙관적 삽입 상태만 관측한다 - 실제 응답 타이밍과의 경쟁을 없앤다.
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), async () => {
        await delay('infinite');
      })
    );
    const existing: Comment = { ...mockComment, id: 'comment-existing', content: '기존 댓글' };
    queryClient.setQueryData(commentKeys.list(POST_ID), [existing]);

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ content: '새 댓글', author: AUTHOR });
    });

    await waitFor(() => {
      const optimistic = queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID)) ?? [];
      expect(optimistic).toHaveLength(2);
      expect(optimistic[0]?.id.startsWith('temp-')).toBe(true);
      expect(optimistic[0]?.content).toBe('새 댓글');
    });
  });

  it('서버 응답이 오면 임시 댓글을 실제 댓글로 id 기준 치환한다 (재조회 없이)', async () => {
    const existing: Comment = { ...mockComment, id: 'comment-existing', content: '기존 댓글' };
    queryClient.setQueryData(commentKeys.list(POST_ID), [existing]);

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ content: '새 댓글', author: AUTHOR });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const settled = queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID)) ?? [];
    expect(settled).toHaveLength(2);
    // 임시 id는 남지 않고, 서버가 돌려준 실제 댓글로 교체된다 (mockComment는 id: comment-uuid-1).
    expect(settled.some((c) => c.id.startsWith('temp-'))).toBe(false);
    expect(settled.find((c) => c.id === mockComment.id)).toBeTruthy();
    expect(settled[1]).toEqual(existing);
  });

  // 응답을 못 받아 목록을 다시 불러온 뒤 재시도하면, 서버가 돌려준 댓글이 이미 목록에 있다
  it('돌려받은 댓글이 이미 목록에 있으면 임시 댓글만 걷어내 같은 댓글이 둘 보이지 않는다', async () => {
    queryClient.setQueryData(commentKeys.list(POST_ID), [mockComment]);

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ content: mockComment.content, author: AUTHOR });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const settled = queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID)) ?? [];
    expect(settled.map((comment) => comment.id)).toEqual([mockComment.id]);
  });

  it('응답을 못 받은 뒤 같은 내용을 다시 보내면 같은 키이고, 내용이 다르면 새 키다', async () => {
    const received: (string | null)[] = [];
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), ({ request }) => {
        received.push(request.headers.get(IDEMPOTENCY_KEY_HEADER));

        return HttpResponse.json({}, { status: 504 });
      })
    );

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });
    const submit = async (content: string) => {
      await act(async () => {
        await result.current.mutateAsync({ content, author: AUTHOR }).catch(() => undefined);
      });
    };

    await submit('같은 키 댓글');
    await submit('같은 키 댓글');
    await submit('고친 댓글');

    expect(received[0]).toBeTruthy();
    expect(received[1]).toBe(received[0]);
    expect(received[2]).not.toBe(received[0]);
  });

  // 이미지는 다시 올릴 때마다 URL이 바뀌므로 파일 속성이 같아야 같은 시도다
  it('같은 본문이라도 첨부 파일이 다르면 새 키다', async () => {
    const received: (string | null)[] = [];
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), ({ request }) => {
        received.push(request.headers.get(IDEMPOTENCY_KEY_HEADER));

        return HttpResponse.json({}, { status: 504 });
      })
    );

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });
    const submit = async (images: File[]) => {
      await act(async () => {
        await result.current
          .mutateAsync({ content: '첨부 댓글', images, author: AUTHOR })
          .catch(() => undefined);
      });
    };
    const first = new File(['aaa'], 'a.png', { type: 'image/png', lastModified: 1 });
    const second = new File(['bbbb'], 'b.png', { type: 'image/png', lastModified: 2 });

    await submit([first]);
    await submit([first]);
    await submit([second]);

    expect(received).toHaveLength(3);
    expect(received[1]).toBe(received[0]);
    expect(received[2]).not.toBe(received[0]);
  });

  it('409 DUPLICATE_COMMENT면 롤백하고 목록을 다시 불러온다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json(
          { status: 409, code: SERVER_ERROR_CODE.DUPLICATE_COMMENT, message: 'duplicate' },
          { status: 409 }
        )
      )
    );
    const existing: Comment = { ...mockComment, id: 'comment-existing', content: '기존 댓글' };
    queryClient.setQueryData(commentKeys.list(POST_ID), [existing]);

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ content: '방금 쓴 댓글', author: AUTHOR });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID))).toEqual([existing]);
    expect(queryClient.getQueryState(commentKeys.list(POST_ID))?.isInvalidated).toBe(true);
  });

  it('실패하면 임시 댓글을 걷어내고 이전 목록으로 롤백한다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 500 })
      )
    );
    const existing: Comment = { ...mockComment, id: 'comment-existing', content: '기존 댓글' };
    queryClient.setQueryData(commentKeys.list(POST_ID), [existing]);

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ content: '실패할 댓글', author: AUTHOR });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID))).toEqual([existing]);
  });

  it('응답 없이 끝나면(504) 저장됐을 수 있으니 댓글 목록을 서버에서 다시 불러온다', async () => {
    const saved: Comment = { ...mockComment, id: 'comment-saved', content: '사실은 저장된 댓글' };
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 504 })
      ),
      http.get(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({ status: 200, message: 'ok', data: [saved], timestamp: '' })
      )
    );
    queryClient.setQueryData(commentKeys.list(POST_ID), []);
    // 무효화가 재조회로 이어지려면 그 쿼리를 보는 화면(관찰자)이 있어야 한다
    renderHook(() => useSuspenseComments(POST_ID), { wrapper: Wrapper });

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ content: '사실은 저장된 댓글', author: AUTHOR });
    });

    await waitFor(() =>
      expect(queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID))).toEqual([saved])
    );
  });

  it('결과가 확실한 실패(500)면 목록을 다시 불러오지 않는다', async () => {
    let refetched = false;
    server.use(
      http.post(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({}, { status: 500 })
      ),
      http.get(url(API_ENDPOINTS.post.postComment(POST_ID)), () => {
        refetched = true;
        return HttpResponse.json({ status: 200, message: 'ok', data: [], timestamp: '' });
      })
    );
    queryClient.setQueryData(commentKeys.list(POST_ID), []);
    renderHook(() => useSuspenseComments(POST_ID), { wrapper: Wrapper });

    const { result } = renderHook(() => useCreateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ content: '실패할 댓글', author: AUTHOR });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(refetched).toBe(false);
  });
});

describe('useCreateReplyMutation', () => {
  it('제출 즉시 부모 댓글의 replies에 임시 답글을 추가한다 (서버 응답을 기다리지 않는다)', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.commentReply('parent-comment')), async () => {
        await delay('infinite');
      })
    );
    const parent: Comment = { ...mockComment, id: 'parent-comment', replies: [] };
    queryClient.setQueryData(commentKeys.list(POST_ID), [parent]);

    const { result } = renderHook(() => useCreateReplyMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        commentId: 'parent-comment',
        content: '새 답글',
        author: { id: mockOtherAccount.id, nickname: mockOtherAccount.nickname, image: null },
      });
    });

    await waitFor(() => {
      const optimistic = (queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID)) ?? [])[0];
      expect(optimistic?.replies).toHaveLength(1);
      expect(optimistic?.replies[0]?.id.startsWith('temp-')).toBe(true);
    });
  });

  it('서버 응답이 오면 부모의 replies에서 임시 답글을 실제 답글로 치환한다', async () => {
    const parent: Comment = { ...mockComment, id: 'parent-comment', replies: [] };
    queryClient.setQueryData(commentKeys.list(POST_ID), [parent]);

    const { result } = renderHook(() => useCreateReplyMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({
        commentId: 'parent-comment',
        content: '새 답글',
        author: { id: mockOtherAccount.id, nickname: mockOtherAccount.nickname, image: null },
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const settled = (queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID)) ?? [])[0];
    expect(settled?.replies).toHaveLength(1);
    expect(settled?.replies[0]?.id).toBe('reply-uuid-1');
  });

  it('돌려받은 답글이 이미 목록에 있으면 임시 답글만 걷어낸다', async () => {
    const reply: Comment = { ...mockComment, id: 'reply-uuid-1', content: '새 답글' };
    const parent: Comment = { ...mockComment, id: 'parent-comment', replies: [reply] };
    queryClient.setQueryData(commentKeys.list(POST_ID), [parent]);

    const { result } = renderHook(() => useCreateReplyMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ commentId: 'parent-comment', content: '새 답글', author: AUTHOR });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const settled = (queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID)) ?? [])[0];
    expect(settled?.replies.map((item) => item.id)).toEqual(['reply-uuid-1']);
  });

  it('응답을 못 받은 뒤 같은 답글을 다시 보내면 같은 키를 쓴다', async () => {
    const received: (string | null)[] = [];
    server.use(
      http.post(url(API_ENDPOINTS.post.commentReply('parent-comment')), ({ request }) => {
        received.push(request.headers.get(IDEMPOTENCY_KEY_HEADER));

        return HttpResponse.json({}, { status: 504 });
      })
    );

    const { result } = renderHook(() => useCreateReplyMutation(POST_ID), { wrapper: Wrapper });
    const submit = async () => {
      await act(async () => {
        await result.current
          .mutateAsync({ commentId: 'parent-comment', content: '다시 쓸 답글', author: AUTHOR })
          .catch(() => undefined);
      });
    };

    await submit();
    await submit();

    expect(received[0]).toBeTruthy();
    expect(received[1]).toBe(received[0]);
  });
});

describe('useUpdateCommentMutation', () => {
  it('루트 댓글 수정 성공 시 content는 응답으로 바뀌고 likeCount·isLiked·replies는 캐시 값을 유지한다', async () => {
    // BE PATCH 응답은 replies/likeCount/isLiked를 항상 기본값(lossy)으로 내려준다 -
    // 그대로 덮어쓰면 좋아요 수가 0으로 리셋되고 답글이 사라지는 회귀가 생긴다.
    const reply: Comment = { ...mockComment, id: 'reply-1', content: '답글' };
    const target: Comment = {
      ...mockComment,
      id: 'comment-existing',
      content: '수정 전',
      likeCount: 3,
      isLiked: true,
      replies: [reply],
    };
    queryClient.setQueryData(commentKeys.list(POST_ID), [target]);

    server.use(
      http.patch(url(API_ENDPOINTS.post.comment('comment-existing')), () =>
        HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: {
              ...mockComment,
              id: 'comment-existing',
              content: '수정 후',
              likeCount: 0,
              isLiked: false,
              replies: [],
            },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        )
      )
    );

    const { result } = renderHook(() => useUpdateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ commentId: 'comment-existing', content: '수정 후' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const settled = (queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID)) ?? [])[0];
    expect(settled?.content).toBe('수정 후');
    expect(settled?.likeCount).toBe(3);
    expect(settled?.isLiked).toBe(true);
    expect(settled?.replies).toEqual([reply]);
  });

  it('답글 수정 성공 시 부모의 replies에서 해당 답글만 갱신되고 형제 답글은 그대로다', async () => {
    const editedReply: Comment = { ...mockComment, id: 'reply-1', content: '답글 수정 전' };
    const siblingReply: Comment = { ...mockComment, id: 'reply-2', content: '형제 답글' };
    const parent: Comment = {
      ...mockComment,
      id: 'parent-comment',
      replies: [editedReply, siblingReply],
    };
    queryClient.setQueryData(commentKeys.list(POST_ID), [parent]);

    server.use(
      http.patch(url(API_ENDPOINTS.post.comment('reply-1')), () =>
        HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockComment, id: 'reply-1', content: '답글 수정 후' },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        )
      )
    );

    const { result } = renderHook(() => useUpdateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ commentId: 'reply-1', content: '답글 수정 후' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const settled = (queryClient.getQueryData<Comment[]>(commentKeys.list(POST_ID)) ?? [])[0];
    expect(settled?.replies.find((r) => r.id === 'reply-1')?.content).toBe('답글 수정 후');
    expect(settled?.replies.find((r) => r.id === 'reply-2')).toEqual(siblingReply);
  });

  it('수정 성공 후에도 댓글 목록 쿼리를 invalidate한다 (정합성 백스톱)', async () => {
    const target: Comment = { ...mockComment, id: 'comment-existing', content: '수정 전' };
    queryClient.setQueryData(commentKeys.list(POST_ID), [target]);

    server.use(
      http.patch(url(API_ENDPOINTS.post.comment('comment-existing')), () =>
        HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockComment, id: 'comment-existing', content: '수정 후' },
            timestamp: new Date().toISOString(),
          },
          { status: 200 }
        )
      )
    );

    const { result } = renderHook(() => useUpdateCommentMutation(POST_ID), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ commentId: 'comment-existing', content: '수정 후' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => {
      expect(queryClient.getQueryState(commentKeys.list(POST_ID))?.isInvalidated).toBe(true);
    });
  });
});

// 게시글 카드 💬·내 댓글 카드 hover의 미리 받기 - 화면이 없을 때 실패하면 조용히 지워, 상세 화면이 열릴 때
// 새로 요청하게 한다(#491 3번)
describe('prefetchComments', () => {
  let commentRequests: number;
  let errorToasts: string[];

  beforeEach(() => {
    commentRequests = 0;
    ({ queryClient, errorToasts } = createQueryClientWithErrorToasts());
  });

  /** 댓글 목록이 500으로 실패하다가 recover 뒤로는 성공한다 */
  function mockCommentList() {
    let failing = true;

    server.use(
      http.get(url(API_ENDPOINTS.post.postComment(POST_ID)), () => {
        commentRequests += 1;

        if (failing) {
          return HttpResponse.json(
            { status: 500, message: 'fail', timestamp: '' },
            { status: 500 }
          );
        }

        return HttpResponse.json({
          status: 200,
          message: 'ok',
          data: [mockComment],
          timestamp: '',
        });
      })
    );

    return {
      recover: () => {
        failing = false;
      },
    };
  }

  it('실패해도 에러 토스트를 띄우지 않고, 실패한 쿼리를 캐시에서 지운다', async () => {
    mockCommentList();

    prefetchComments(queryClient, POST_ID);

    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    expect(queryClient.getQueryState(commentKeys.list(POST_ID))).toBeUndefined();
    expect(errorToasts).toEqual([]);
  });

  it('실패한 뒤 댓글 목록이 열리면 새로 요청해 보여 준다', async () => {
    const comments = mockCommentList();

    prefetchComments(queryClient, POST_ID);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
    comments.recover();
    const requestsBeforeScreen = commentRequests;

    const { result } = renderHook(() => useSuspenseComments(POST_ID), {
      wrapper: ({ children }: { children: ReactNode }) =>
        createElement(
          Wrapper,
          null,
          createElement(
            ErrorBoundary,
            { fallback: createElement('div', null, 'comments-error') },
            createElement(Suspense, { fallback: null }, children)
          )
        ),
    });

    await waitFor(() => expect(result.current?.data).toEqual([mockComment]));
    expect(commentRequests - requestsBeforeScreen).toBe(1);
  });
});

describe('seedEmptyComments', () => {
  // 운영 staleTime - 심은 값이 이 시간 안에도 오래된 값으로 취급되는지 보려면 같은 값이어야 한다
  const PRODUCTION_STALE_TIME_MS = 3 * 60 * 1000;
  let commentRequests: number;
  let serverComments: Comment[];

  beforeEach(() => {
    commentRequests = 0;
    serverComments = [];
    queryClient = createTestQueryClient({ gcTime: Infinity, staleTime: PRODUCTION_STALE_TIME_MS });
    server.use(
      http.get(url(API_ENDPOINTS.post.postComment(POST_ID)), () => {
        commentRequests += 1;

        return HttpResponse.json({
          status: 200,
          message: 'ok',
          data: serverComments,
          timestamp: '',
        });
      })
    );
  });

  it('요청 없이 빈 목록을 오래된 값으로 심는다', () => {
    seedEmptyComments(queryClient, POST_ID);

    const state = queryClient.getQueryState(commentKeys.list(POST_ID));

    expect(state?.data).toEqual([]);
    expect(state?.dataUpdatedAt).toBe(0);
    expect(commentRequests).toBe(0);
  });

  it('이미 받은 댓글을 덮어쓰지 않는다', () => {
    queryClient.setQueryData(commentKeys.list(POST_ID), [mockComment]);

    seedEmptyComments(queryClient, POST_ID);

    expect(queryClient.getQueryData(commentKeys.list(POST_ID))).toEqual([mockComment]);
  });

  it('받는 중인 요청을 건드리지 않아 응답이 그대로 캐시에 들어간다', async () => {
    serverComments = [mockComment];

    prefetchComments(queryClient, POST_ID);
    seedEmptyComments(queryClient, POST_ID);

    expect(queryClient.getQueryData(commentKeys.list(POST_ID))).toBeUndefined();
    await waitFor(() =>
      expect(queryClient.getQueryData(commentKeys.list(POST_ID))).toEqual([mockComment])
    );
    expect(commentRequests).toBe(1);
  });

  it('댓글 목록은 멈추지 않고 빈 목록을 바로 그린 뒤, 한 번 다시 받아 그 사이 달린 댓글을 보여 준다', async () => {
    serverComments = [mockComment];
    seedEmptyComments(queryClient, POST_ID);

    const { result } = renderHook(() => useSuspenseComments(POST_ID), { wrapper: Wrapper });

    expect(result.current.data).toEqual([]);
    await waitFor(() => expect(result.current.data).toEqual([mockComment]));
    expect(commentRequests).toBe(1);
  });

  it('다시 받기가 실패하면 에러 화면 대신 빈 목록을 유지하고 토스트를 띄운다', async () => {
    const { queryClient: toastQueryClient, errorToasts } = createQueryClientWithErrorToasts();
    queryClient = toastQueryClient;
    server.use(
      http.get(url(API_ENDPOINTS.post.postComment(POST_ID)), () =>
        HttpResponse.json({ status: 500, message: 'fail', timestamp: '' }, { status: 500 })
      )
    );
    seedEmptyComments(queryClient, POST_ID);

    const { result } = renderHook(() => useSuspenseComments(POST_ID), { wrapper: Wrapper });

    await waitFor(() => expect(errorToasts).toHaveLength(1));
    expect(result.current.data).toEqual([]);
  });
});
