import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
  type QueryKey,
  type UseMutationResult,
} from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { server } from '@/mocks/server';
import { mockPost } from '@/mocks/fixtures/post.fixtures';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { TEXTS } from '@/shared/config/texts';
import { rememberMutationAuthEpoch } from '@/shared/lib/react-query/config/mutation-auth-epoch';
import { toast } from '@/shared/lib/toast/toast';
import { ApiError, NetworkError, SessionChangedError } from '@/shared/types/common.type';
import { AuthEpochUtil } from '@/shared/utils/auth-epoch.util';
import { accountKeys } from '@/entities/account/api/account.keys';
import {
  useDeleteAccountMutation,
  useUpdateAccountMutation,
} from '@/entities/account/api/account.queries';
import {
  useChangePasswordMutation,
  useConfirmEmailVerificationMutation,
  useConfirmPasswordResetMutation,
  useCreateAccountMutation,
  useLoginMutation,
  useRequestEmailVerificationMutation,
  useRequestPasswordResetMutation,
} from '@/entities/auth/api/auth.queries';
import { bookmarkFolderKeys } from '@/entities/bookmark/folder/api/bookmark-folder.keys';
import {
  useAddBookmarkFolderMutation,
  useClearBookmarkFoldersMutation,
  useCreateBookmarkFolderMutation,
  useDeleteBookmarkFolderMutation,
  useRemoveBookmarkFolderMutation,
  useSetBookmarkFolderPinMutation,
  useUpdateBookmarkFolderMutation,
} from '@/entities/bookmark/folder/api/bookmark-folder.queries';
import { commentKeys } from '@/entities/comment/api/comment.keys';
import {
  useCreateCommentMutation,
  useCreateReplyMutation,
  useUpdateCommentMutation,
} from '@/entities/comment/api/comment.queries';
import {
  useBookmarkPostMutation,
  useLikeCommentMutation,
  useLikePostMutation,
} from '@/entities/interaction/api/interaction.queries';
import { postKeys } from '@/entities/post/api/post.keys';
import {
  useCreatePostMutation,
  useUpdatePostMutation,
  useUpdatePostVisibilityMutation,
} from '@/entities/post/api/post.queries';
import { createTestQueryClient } from '@/test/utils';

// 쓰기 요청을 응답을 못 받았을 때의 처리(docs/FE-ARCHITECTURE.md §28)별로 묶어 같은 단정을 돌린다. 글·댓글 삭제는
// post.queries.test.ts·comment.queries.test.ts, 폴더 만들기의 이름 대조와 폴더 삭제의 404는
// bookmark-folder.queries.test.ts가 본다

const POST_ID = mockPost.id;
const COMMENT_ID = 'comment-uuid-1';
const COMMENT_LIST_KEY = commentKeys.list(POST_ID);
const FOLDER_ID = 'folder-uuid-1';
const PASSWORD = 'password1!';
const CHANGE_PASSWORD = {
  currentPassword: PASSWORD,
  newPassword: 'newPassword1!',
  confirmPassword: 'newPassword1!',
};

type Method = 'post' | 'put' | 'patch' | 'delete';
interface Outcome {
  status: 'fulfilled' | 'rejected';
  error?: unknown;
}

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(MemoryRouter, null, children)
  );
}

/** 훅을 그려 한 번 실행하고 끝날 때까지 기다린다 */
const mutationRunner =
  <TData, TError, TVariables, TContext>(
    useTarget: () => UseMutationResult<TData, TError, TVariables, TContext>,
    variables: TVariables
  ) =>
  async (): Promise<Outcome> => {
    const { result } = renderHook(useTarget, { wrapper: Wrapper });
    let outcome: Outcome | undefined;

    await act(async () => {
      outcome = await result.current.mutateAsync(variables).then(
        (): Outcome => ({ status: 'fulfilled' }),
        (error: unknown): Outcome => ({ status: 'rejected', error })
      );
    });

    return outcome!;
  };

interface MutationCase {
  name: string;
  method: Method;
  path: string;
  run: () => Promise<Outcome>;
  /** 응답을 못 받았을 때 다시 받는 캐시 */
  reloads?: QueryKey[];
  /** 서버가 실패라고 답했을 때도(기존 실패 처리) 다시 받는 요청이면 true */
  reloadsOnAnyFailure?: boolean;
  /** 직접 띄우는 실패 토스트 문구. 조용히 되돌리는 요청과 폼 훅이 안내하는 요청은 없다 */
  toast?: { unknown: string; failed: string };
}

const RESEND_CASES: MutationCase[] = [
  {
    name: '글 좋아요',
    method: 'put',
    path: API_ENDPOINTS.post.postLike(POST_ID),
    run: mutationRunner(() => useLikePostMutation(POST_ID), true),
  },
  {
    name: '글 북마크',
    method: 'put',
    path: API_ENDPOINTS.post.postBookmark(POST_ID),
    run: mutationRunner(() => useBookmarkPostMutation(POST_ID), true),
  },
  {
    name: '댓글 좋아요',
    method: 'put',
    path: API_ENDPOINTS.post.commentLike(COMMENT_ID),
    run: mutationRunner(() => useLikeCommentMutation(COMMENT_ID, POST_ID), true),
  },
  {
    name: '폴더 고정',
    method: 'put',
    path: API_ENDPOINTS.bookmark.folderPin(FOLDER_ID),
    run: mutationRunner(() => useSetBookmarkFolderPinMutation(FOLDER_ID), true),
    reloads: [bookmarkFolderKeys.list],
    reloadsOnAnyFailure: true,
    toast: {
      unknown: TEXTS.messages.error.outcomeUnknown,
      failed: TEXTS.messages.error.folderPinFailed,
    },
  },
  {
    name: '폴더에 담기',
    method: 'post',
    path: API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_ID),
    run: mutationRunner(() => useAddBookmarkFolderMutation(POST_ID), FOLDER_ID),
  },
  {
    name: '폴더에서 빼기',
    method: 'delete',
    path: API_ENDPOINTS.bookmark.postFolder(POST_ID, FOLDER_ID),
    run: mutationRunner(() => useRemoveBookmarkFolderMutation(POST_ID), FOLDER_ID),
  },
  {
    name: '폴더 전부 빼기',
    method: 'delete',
    path: API_ENDPOINTS.bookmark.postFolders(POST_ID),
    run: mutationRunner(() => useClearBookmarkFoldersMutation(POST_ID), undefined),
  },
  {
    name: '폴더 이름 변경',
    method: 'patch',
    path: API_ENDPOINTS.bookmark.folder(FOLDER_ID),
    run: mutationRunner(() => useUpdateBookmarkFolderMutation(FOLDER_ID), { name: '새 이름' }),
    reloads: [bookmarkFolderKeys.list],
  },
  {
    name: '폴더 삭제',
    method: 'delete',
    path: API_ENDPOINTS.bookmark.folder(FOLDER_ID),
    run: mutationRunner(() => useDeleteBookmarkFolderMutation(FOLDER_ID), undefined),
    reloads: [bookmarkFolderKeys.list, bookmarkFolderKeys.posts(FOLDER_ID), postKeys.list()],
  },
  {
    name: '폴더 만들기',
    method: 'post',
    path: API_ENDPOINTS.bookmark.folders,
    run: mutationRunner(() => useCreateBookmarkFolderMutation(), { name: '새 폴더' }),
    reloads: [bookmarkFolderKeys.list],
  },
  {
    name: '글 공개 전환',
    method: 'patch',
    path: `${API_ENDPOINTS.post.base}/${POST_ID}/visibility`,
    run: mutationRunner(() => useUpdatePostVisibilityMutation(POST_ID), {
      postId: POST_ID,
      isPrivate: true,
    }),
    reloads: [postKeys.detail(POST_ID), postKeys.list(), bookmarkFolderKeys.posts(FOLDER_ID)],
    toast: {
      unknown: TEXTS.messages.error.outcomeUnknown,
      failed: TEXTS.messages.error.postVisibilityUpdateFailed,
    },
  },
  {
    name: '글 수정',
    method: 'patch',
    path: `${API_ENDPOINTS.post.base}/${POST_ID}`,
    run: mutationRunner(() => useUpdatePostMutation(POST_ID), {
      url: mockPost.url,
      title: '',
      isPrivate: false,
    }),
    reloads: [postKeys.detail(POST_ID), postKeys.list(), bookmarkFolderKeys.posts(FOLDER_ID)],
  },
  {
    name: '댓글 수정',
    method: 'patch',
    path: API_ENDPOINTS.post.comment(COMMENT_ID),
    run: mutationRunner(() => useUpdateCommentMutation(POST_ID), {
      commentId: COMMENT_ID,
      content: '수정',
    }),
    reloads: [COMMENT_LIST_KEY],
  },
  {
    name: '프로필 수정',
    method: 'patch',
    path: API_ENDPOINTS.auth.updateAccount,
    run: mutationRunner(() => useUpdateAccountMutation(), { nickname: 'newNick' }),
    reloads: [accountKeys.root, postKeys.list(), COMMENT_LIST_KEY],
    toast: {
      unknown: TEXTS.messages.error.outcomeUnknown,
      failed: TEXTS.messages.error.accountUpdateFailed,
    },
  },
  // 등록은 Idempotency-Key로 서버가 중복을 막아(docs/FE-ARCHITECTURE.md §27) 다시 보내도 하나만 생긴다
  {
    name: '글 등록',
    method: 'post',
    path: API_ENDPOINTS.post.base,
    run: mutationRunner(() => useCreatePostMutation(), {
      url: mockPost.url,
      title: '',
      categoryIds: [],
      folderIds: [],
      isPrivate: false,
      bookmark: false,
    }),
    reloads: [postKeys.list()],
  },
  {
    name: '댓글 등록',
    method: 'post',
    path: API_ENDPOINTS.post.postComment(POST_ID),
    run: mutationRunner(() => useCreateCommentMutation(POST_ID), {
      content: '댓글',
      author: { id: mockAccount.id, nickname: mockAccount.nickname, image: null },
    }),
    reloads: [COMMENT_LIST_KEY],
  },
  {
    name: '답글 등록',
    method: 'post',
    path: API_ENDPOINTS.post.commentReply(COMMENT_ID),
    run: mutationRunner(() => useCreateReplyMutation(POST_ID), {
      commentId: COMMENT_ID,
      content: '답글',
      author: { id: mockAccount.id, nickname: mockAccount.nickname, image: null },
    }),
    reloads: [COMMENT_LIST_KEY],
  },
  {
    name: '재설정 메일 요청',
    method: 'post',
    path: API_ENDPOINTS.auth.passwordResetRequest,
    run: mutationRunner(() => useRequestPasswordResetMutation(), { email: 'user@example.com' }),
    toast: {
      unknown: TEXTS.messages.error.mailRequestOutcomeUnknown,
      failed: TEXTS.messages.error.passwordResetRequestFailed,
    },
  },
  {
    name: '인증 메일 요청',
    method: 'post',
    path: API_ENDPOINTS.auth.emailVerificationRequest,
    run: mutationRunner(() => useRequestEmailVerificationMutation(), { email: 'user@example.com' }),
    toast: {
      unknown: TEXTS.messages.error.mailRequestOutcomeUnknown,
      failed: TEXTS.messages.error.emailVerificationRequestFailed,
    },
  },
];

const NO_RESEND_CASES: MutationCase[] = [
  {
    name: '로그인',
    method: 'post',
    path: API_ENDPOINTS.auth.login,
    run: mutationRunner(() => useLoginMutation(), {
      email: 'user@example.com',
      password: PASSWORD,
    }),
    // 응답을 못 받으면 이 탭은 로그인되지 않아 다시 누르면 된다 - 문구를 바꾸지 않는다
    toast: {
      unknown: TEXTS.messages.error.loginFailed,
      failed: TEXTS.messages.error.loginFailed,
    },
  },
  {
    name: '가입',
    method: 'post',
    path: API_ENDPOINTS.auth.signup,
    run: mutationRunner(() => useCreateAccountMutation(), {
      nickname: 'newNick',
      email: 'new@example.com',
      password: PASSWORD,
      confirmPassword: PASSWORD,
    }),
  },
  {
    name: '재설정 확정',
    method: 'post',
    path: API_ENDPOINTS.auth.passwordResetConfirm,
    run: mutationRunner(() => useConfirmPasswordResetMutation(), {
      token: 'token',
      newPassword: PASSWORD,
      confirmPassword: PASSWORD,
    }),
    toast: {
      unknown: TEXTS.messages.error.passwordResetConfirmOutcomeUnknown,
      failed: TEXTS.messages.error.passwordResetConfirmFailed,
    },
  },
  {
    name: '이메일 인증 확정',
    method: 'post',
    path: API_ENDPOINTS.auth.emailVerificationConfirm,
    run: mutationRunner(() => useConfirmEmailVerificationMutation(), { token: 'token' }),
    reloads: [accountKeys.root],
  },
  {
    name: '비밀번호 변경',
    method: 'patch',
    path: API_ENDPOINTS.auth.changePassword,
    run: mutationRunner(() => useChangePasswordMutation(), CHANGE_PASSWORD),
    toast: {
      unknown: TEXTS.messages.error.passwordChangeOutcomeUnknown,
      failed: TEXTS.messages.error.passwordChangeFailed,
    },
  },
  {
    name: '탈퇴',
    method: 'post',
    path: API_ENDPOINTS.auth.deleteAccount,
    run: mutationRunner(() => useDeleteAccountMutation(), { password: PASSWORD }),
    toast: {
      unknown: TEXTS.messages.error.accountDeleteOutcomeUnknown,
      failed: TEXTS.messages.error.accountDeleteFailed,
    },
  },
];

const CUT = () => HttpResponse.error();
const GATEWAY_TIMEOUT = () => HttpResponse.json({}, { status: 504 });
const SERVER_ERROR = () =>
  HttpResponse.json(
    { status: 500, code: 'INTERNAL_SERVER_ERROR', message: 'boom', timestamp: '' },
    { status: 500 }
  );
const OK = () =>
  HttpResponse.json({ status: 200, message: 'ok', data: {}, timestamp: '' }, { status: 200 });

/** 차례대로 응답하고(마지막 응답을 반복) 온 요청 수를 센다 */
const respondInOrder = (
  { method, path }: Pick<MutationCase, 'method' | 'path'>,
  responses: (() => Response)[]
) => {
  const calls = { count: 0 };

  server.use(
    http[method](`${API_BASE_URL}${path}`, () => {
      calls.count += 1;

      return responses[Math.min(calls.count, responses.length) - 1]!();
    })
  );

  return calls;
};

// 낙관적 업데이트가 캐시를 읽으므로 모양을 맞춘다 - 댓글 목록은 배열, 나머지는 폴더 목록·글 목록의 빈 값
const seedReloads = ({ reloads = [] }: MutationCase) => {
  reloads.forEach((key) => {
    queryClient.setQueryData(
      key,
      key === COMMENT_LIST_KEY ? [] : { folders: [], pages: [], pageParams: [] }
    );
  });
};

const expectReloaded = ({ reloads = [] }: MutationCase, expected: boolean) => {
  reloads.forEach((key) => {
    expect(queryClient.getQueryState(key)?.isInvalidated, JSON.stringify(key)).toBe(expected);
  });
};

const expectToast = (message: string | undefined) => {
  const errorToast = vi.mocked(toast.error);

  if (message === undefined) {
    expect(errorToast).not.toHaveBeenCalled();
    return;
  }

  expect(errorToast).toHaveBeenCalledTimes(1);
  expect(errorToast.mock.calls[0]?.[0]).toBe(message);
};

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(toast, 'error');
  vi.spyOn(toast, 'success');
  vi.spyOn(toast, 'info');
  sessionStorage.clear();
  queryClient = createTestQueryClient({ gcTime: Infinity });
});

afterEach(() => {
  vi.restoreAllMocks();
});

/** 키를 실어 보내는 등록 요청 - 다시 보내도 같은 키여야 서버가 중복을 막는다 */
const IDEMPOTENT_CREATE_CASES = RESEND_CASES.filter(({ name }) =>
  ['글 등록', '댓글 등록', '답글 등록', '재설정 메일 요청', '인증 메일 요청'].includes(name)
);

describe('키를 실어 보내는 등록 요청', () => {
  it.each(IDEMPOTENT_CREATE_CASES)(
    '$name은 다시 보낼 때 같은 키를 싣는다',
    async (mutationCase) => {
      const keys: (string | null)[] = [];
      let attempt = 0;
      server.use(
        http[mutationCase.method](`${API_BASE_URL}${mutationCase.path}`, ({ request }) => {
          keys.push(request.headers.get('Idempotency-Key'));
          attempt += 1;

          return attempt === 1 ? CUT() : OK();
        })
      );

      const outcome = await mutationCase.run();

      expect(outcome.status).toBe('fulfilled');
      expect(keys).toHaveLength(2);
      expect(keys[0]).toBeTruthy();
      expect(keys[1]).toBe(keys[0]);
    }
  );
});

describe('응답을 못 받으면 한 번 더 보내는 요청', () => {
  describe.each(RESEND_CASES)('$name', (mutationCase) => {
    it.each([
      { first: '연결 끊김', firstResponse: CUT },
      { first: '504', firstResponse: GATEWAY_TIMEOUT },
    ])(
      '$first 뒤 다시 보내 성공하면 성공으로 끝나고 실패 안내가 없다',
      async ({ firstResponse }) => {
        const onSuccess = vi.fn();
        queryClient = new QueryClient({
          mutationCache: new MutationCache({ onSuccess }),
          defaultOptions: { mutations: { retryDelay: 0 } },
        });
        const calls = respondInOrder(mutationCase, [firstResponse, OK]);

        const outcome = await mutationCase.run();

        expect(outcome.status).toBe('fulfilled');
        expect(calls.count).toBe(2);
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(toast.error).not.toHaveBeenCalled();
      }
    );

    it('두 번 다 응답이 없으면 더 보내지 않고 확인하지 못했다고 안내한 뒤 화면을 다시 받는다', async () => {
      const calls = respondInOrder(mutationCase, [CUT]);
      seedReloads(mutationCase);

      const outcome = await mutationCase.run();

      expect(calls.count).toBe(2);
      expect(outcome.error).toBeInstanceOf(NetworkError);
      expectToast(mutationCase.toast?.unknown);
      expectReloaded(mutationCase, true);
    });

    it('서버가 실패라고 답하면(500) 다시 보내지 않고 실패 안내를 그대로 둔다', async () => {
      const calls = respondInOrder(mutationCase, [SERVER_ERROR]);
      seedReloads(mutationCase);

      const outcome = await mutationCase.run();

      expect(calls.count).toBe(1);
      expect(outcome.error).toBeInstanceOf(ApiError);
      expectToast(mutationCase.toast?.failed);
      expectReloaded(mutationCase, mutationCase.reloadsOnAnyFailure === true);
    });

    // 누른 계정의 동작이 바뀐 계정으로 실행되면 안 된다(mutation-auth-epoch.ts) - queryClient.ts와 같은 전역 onMutate가 필요하다
    it('다시 보내기 전에 계정이 바뀌었으면 보내지 않는다', async () => {
      queryClient = new QueryClient({
        mutationCache: new MutationCache({
          onMutate: (_variables, _mutation, context) => rememberMutationAuthEpoch(context),
        }),
        defaultOptions: { mutations: { retryDelay: 0 } },
      });
      const calls = { count: 0 };
      server.use(
        http[mutationCase.method](`${API_BASE_URL}${mutationCase.path}`, () => {
          calls.count += 1;
          AuthEpochUtil.markLogout();

          return CUT();
        })
      );

      const outcome = await mutationCase.run();

      expect(calls.count).toBe(1);
      expect(outcome.error).toBeInstanceOf(SessionChangedError);
    });
  });
});

describe('다시 보내지 않는 요청', () => {
  describe.each(NO_RESEND_CASES)('$name', (mutationCase) => {
    it.each([
      { failure: '연결 끊김', response: CUT },
      { failure: '504', response: GATEWAY_TIMEOUT },
    ])('$failure면 1번만 보내고 안내한 뒤 화면을 다시 받는다', async ({ response }) => {
      const calls = respondInOrder(mutationCase, [response]);
      seedReloads(mutationCase);

      const outcome = await mutationCase.run();

      expect(calls.count).toBe(1);
      expect(outcome.status).toBe('rejected');
      expectToast(mutationCase.toast?.unknown);
      expectReloaded(mutationCase, true);
    });

    it('서버가 실패라고 답하면(500) 실패 안내를 그대로 두고 화면을 다시 받지 않는다', async () => {
      const calls = respondInOrder(mutationCase, [SERVER_ERROR]);
      seedReloads(mutationCase);

      const outcome = await mutationCase.run();

      expect(calls.count).toBe(1);
      expect(outcome.status).toBe('rejected');
      expectToast(mutationCase.toast?.failed);
      expectReloaded(mutationCase, false);
    });
  });
});
