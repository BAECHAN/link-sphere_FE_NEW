import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { server } from '@/mocks/server';
import { http, HttpResponse, delay } from 'msw';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { createElement, type ReactNode } from 'react';
import { createTestQueryClient } from '@/test/utils';
import { useUpdateAccountMutation } from '@/entities/account/api/account.queries';
import { accountKeys } from '@/entities/account/api/account.keys';
import { mockAccount } from '@/mocks/fixtures/account.fixtures';
import type { Account } from '@/entities/account/model/account.schema';
import { TEXTS } from '@/shared/config/texts';

vi.mock('@/shared/lib/firebase/fcm', () => ({
  requestAndRegisterFcmToken: vi.fn(),
  unregisterFcmToken: vi.fn(),
}));

const mockToastError = vi.fn();
vi.mock('@/shared/lib/toast/toast', () => ({
  toast: {
    error: (...args: unknown[]) => {
      mockToastError(...args);
    },
    success: vi.fn(),
  },
}));

const mockHandleAccountUpdateSuccess = vi.fn();

vi.mock('@/entities/account/api/account.keys', () => ({
  accountKeys: { root: ['account'] },
  accountMutationKeys: { update: ['account', 'update'] },
  handleAccountUpdateSuccess: () => {
    mockHandleAccountUpdateSuccess();
  },
}));

// setQueryData로 캐시를 심고 나중에 getQueryData로 검증하므로 gcTime: Infinity가 필요하다
// (createTestQueryClient 참고).
let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(MemoryRouter, null, children)
  );
}

beforeEach(() => {
  queryClient = createTestQueryClient({ gcTime: Infinity });
});

describe('useUpdateAccountMutation', () => {
  beforeEach(() => {
    mockHandleAccountUpdateSuccess.mockClear();
    mockToastError.mockClear();
    queryClient.setQueryData(accountKeys.root, mockAccount);
  });

  it('제출 즉시 캐시를 낙관적으로 반영한다 (서버 응답을 기다리지 않는다)', async () => {
    // 응답을 영원히 지연시켜 낙관적 반영 상태만 관측한다
    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async () => {
        await delay('infinite');
      })
    );

    const { result } = renderHook(() => useUpdateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ nickname: 'newNick' });
    });

    await waitFor(() => {
      expect(queryClient.getQueryData<Account>(accountKeys.root)?.nickname).toBe('newNick');
    });
  });

  it('성공 시 서버 응답으로 캐시를 치환하고 포스트 목록 갱신 핸들러를 호출한다', async () => {
    const { result } = renderHook(() => useUpdateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ nickname: 'newNick' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockHandleAccountUpdateSuccess).toHaveBeenCalled();
    expect(queryClient.getQueryData<Account>(accountKeys.root)?.nickname).toBe('newNick');
  });

  it('409 에러 시 낙관적으로 반영했던 캐시를 이전 값으로 롤백한다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.auth.updateAccount), () =>
        HttpResponse.json(
          { code: 'DUPLICATE_MEMBER', message: 'Nickname already exists' },
          { status: 409 }
        )
      )
    );

    const { result } = renderHook(() => useUpdateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ nickname: 'taken' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(queryClient.getQueryData<Account>(accountKeys.root)?.nickname).toBe(
      mockAccount.nickname
    );
  });

  it('새 아바타 파일이 있으면 업로드 후 그 URL로 계정을 갱신한다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.upload.signedUrl), () =>
        HttpResponse.json(
          {
            status: 201,
            message: 'ok',
            data: {
              uploadUrl: 'https://fake-storage.test/upload',
              token: 'fake-token',
              publicUrl: 'https://example.com/new-avatar.png',
            },
            timestamp: '',
          },
          { status: 201 }
        )
      ),
      http.put('https://fake-storage.test/upload', () => new HttpResponse(null, { status: 200 })),
      http.patch(url(API_ENDPOINTS.auth.updateAccount), async ({ request }) => {
        const body = (await request.json()) as { nickname?: string; image?: string };
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { ...mockAccount, ...body }, timestamp: '' },
          { status: 200 }
        );
      })
    );

    const file = new File(['img'], 'avatar.png', { type: 'image/png' });
    const { result } = renderHook(() => useUpdateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ nickname: mockAccount.nickname, file });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.image).toBe('https://example.com/new-avatar.png');
  });

  it('네트워크 오류 등 일반 에러는 날것 메시지 대신 일반 실패 메시지로 감싼다', async () => {
    // MSW의 네트워크 레벨 에러 - fetch가 TypeError를 던지는 실제 오프라인 상황과 동일하게 재현
    server.use(http.patch(url(API_ENDPOINTS.auth.updateAccount), () => HttpResponse.error()));

    const { result } = renderHook(() => useUpdateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ nickname: 'newNick' });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith(
      TEXTS.messages.error.accountUpdateFailed,
      expect.anything()
    );
    // 브라우저의 날것 네트워크 에러 문구가 그대로 노출되지 않았는지 확인
    expect(mockToastError).not.toHaveBeenCalledWith(
      expect.stringContaining('fetch'),
      expect.anything()
    );
  });

  it('이미지 용량 초과처럼 우리가 직접 던진 UserFacingError는 구체적인 메시지를 그대로 보여준다', async () => {
    const file = new File(['img'], 'huge.png', { type: 'image/png' });
    Object.defineProperty(file, 'size', { value: 31 * 1024 * 1024 });

    const { result } = renderHook(() => useUpdateAccountMutation(), { wrapper: Wrapper });

    act(() => {
      result.current.mutate({ nickname: mockAccount.nickname, file });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(mockToastError).toHaveBeenCalledWith(
      TEXTS.validation.imageTooLarge(30),
      expect.anything()
    );
  });
});
