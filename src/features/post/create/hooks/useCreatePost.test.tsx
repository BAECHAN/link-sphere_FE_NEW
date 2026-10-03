import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { type ReactNode } from 'react';
import { http, HttpResponse } from 'msw';
import { server } from '@/mocks/server';
import { createTestQueryClient } from '@/test/utils';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';
import { useCreatePost } from '@/features/post/create/hooks/useCreatePost';

const navigateSpy = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => navigateSpy };
});

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;
const SUBMITTED_URL = 'https://example.com/article';

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  };
}

async function fillAndSubmit(result: { current: ReturnType<typeof useCreatePost> }) {
  act(() => {
    result.current.form.setValue('url', SUBMITTED_URL, { shouldDirty: true, shouldValidate: true });
  });

  await act(async () => {
    await result.current.onSubmit();
  });
}

describe('useCreatePost', () => {
  beforeEach(() => {
    navigateSpy.mockClear();
  });

  it('등록이 성공한 뒤에만 폼을 비우고 목록으로 이동한다', async () => {
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await fillAndSubmit(result);

    expect(navigateSpy).toHaveBeenCalledWith(ROUTES_PATHS.POST.ROOT, { replace: true });
    expect(result.current.form.getValues('url')).toBe('');
  });

  it('등록이 실패하면 이동하지 않고 입력한 값을 그대로 남긴다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.base), () =>
        HttpResponse.json(
          { status: 429, code: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' },
          { status: 429 }
        )
      )
    );
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await fillAndSubmit(result);

    expect(navigateSpy).not.toHaveBeenCalled();
    expect(result.current.form.getValues('url')).toBe(SUBMITTED_URL);
    // 입력칸과 무관한 실패라 버튼 위 안내로 남는다
    expect(result.current.submitError?.message).toBe(TEXTS.messages.error.postSubmit.rateLimited);
  });

  it('도메인을 찾을 수 없으면 URL 칸에 서버 에러를 붙이고 버튼 위 안내는 띄우지 않는다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.post.base), () =>
        HttpResponse.json(
          { status: 400, code: 'URL_UNRESOLVABLE', message: 'Cannot resolve host' },
          { status: 400 }
        )
      )
    );
    const { result } = renderHook(() => useCreatePost(), {
      wrapper: createWrapper(createTestQueryClient()),
    });

    await fillAndSubmit(result);

    expect(result.current.form.getFieldState('url').error?.message).toBe(
      TEXTS.messages.error.postSubmit.urlUnresolvable
    );
    expect(result.current.submitError).toBeNull();
  });
});
