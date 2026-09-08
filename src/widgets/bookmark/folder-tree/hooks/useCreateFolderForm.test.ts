import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { useCreateFolderForm } from '@/widgets/bookmark/folder-tree/hooks/useCreateFolderForm';

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

// 기본 bookmarkFolderHandlers는 폴더 CRUD(POST)를 등록하지 않고, 등록된 나머지도 API_BASE_URL
// 접두사 없이 등록돼 있다 - url()로 명시 등록.
const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useCreateFolderForm', () => {
  it('이름을 넣고 제출하면 POST가 나가고 입력이 비워지며 onCreated가 호출된다', async () => {
    let requestedBody: unknown;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), async ({ request }) => {
        requestedBody = await request.json();
        return HttpResponse.json(
          { status: 201, message: 'ok', data: { id: 'new-folder' }, timestamp: '' },
          { status: 201 }
        );
      })
    );
    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateFolderForm({ onCreated }), {
      wrapper: Wrapper,
    });

    act(() => result.current.setName('  새 폴더  '));
    await act(async () => result.current.submit());

    expect(requestedBody).toEqual({ name: '새 폴더' });
    expect(result.current.name).toBe('');
    expect(onCreated).toHaveBeenCalledTimes(1);
  });

  it('빈 문자열이면 요청도 onCreated도 없다', async () => {
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () => {
        requested = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateFolderForm({ onCreated }), {
      wrapper: Wrapper,
    });

    await act(async () => result.current.submit());

    expect(requested).toBe(false);
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('공백만이면 요청도 onCreated도 없다', async () => {
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () => {
        requested = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const { result } = renderHook(() => useCreateFolderForm({ onCreated: vi.fn() }), {
      wrapper: Wrapper,
    });

    act(() => result.current.setName('   '));
    await act(async () => result.current.submit());

    expect(requested).toBe(false);
  });

  it('연속 제출해도 POST는 1회만 나간다 (submittingRef 가드)', async () => {
    let requestCount = 0;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), async () => {
        requestCount += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return HttpResponse.json(
          { status: 201, message: 'ok', data: { id: 'new-folder' }, timestamp: '' },
          { status: 201 }
        );
      })
    );
    const { result } = renderHook(() => useCreateFolderForm({ onCreated: vi.fn() }), {
      wrapper: Wrapper,
    });

    act(() => result.current.setName('폴더'));
    await act(async () => {
      const first = result.current.submit();
      const second = result.current.submit();
      await Promise.all([first, second]);
    });

    expect(requestCount).toBe(1);
  });

  it('실패하면 토스트를 띄우고 onCreated를 호출하지 않는다 (재시도 가능하도록 입력을 지우지 않는다)', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () =>
        HttpResponse.json(
          { status: 500, code: 'SERVER_ERROR', message: '', timestamp: '' },
          { status: 500 }
        )
      )
    );
    const errorSpy = vi.spyOn(toast, 'error');
    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateFolderForm({ onCreated }), {
      wrapper: Wrapper,
    });

    act(() => result.current.setName('폴더'));
    await act(async () => result.current.submit());

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderCreateFailed)
    );
    expect(onCreated).not.toHaveBeenCalled();
    expect(result.current.name).toBe('폴더');
  });
});
