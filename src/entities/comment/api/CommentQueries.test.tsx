import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse, delay } from 'msw';
import { type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import { mockComment } from '@/mocks/fixtures/comment.fixtures';
import { mockAccount, mockOtherAccount } from '@/mocks/fixtures/auth.fixtures';
import type { Comment } from '@/entities/comment/model/comment.schema';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
  useUpdateCommentMutation,
} from '@/entities/comment/api/comment.queries';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function Wrapper({ children }: { children: ReactNode }) {
  // 옵티미스틱 업데이트가 싱글톤 queryClient를 직접 조작하므로 동일 인스턴스를 provider로 사용
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

const POST_ID = mockComment.postId;
const AUTHOR = { id: mockAccount.id, nickname: mockAccount.nickname, image: null };

beforeEach(() => {
  queryClient.clear();
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

afterEach(() => {
  queryClient.clear();
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
