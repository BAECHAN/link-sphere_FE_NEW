import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type KeyboardEvent, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { useCreateFolderCard } from '@/widgets/bookmark/folder-tree/hooks/useMobileFolderList';

// useMobileFolderList(루트)는 useFolderSections의 순수 별칭이라 여기서 다루지 않는다
// (docs/plans/2026-09-08-selective-test-coverage.md 참고). useCreateFolderCard만 대상.

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

function keyEvent(key: string, isComposing = false): KeyboardEvent<HTMLInputElement> {
  return {
    key,
    nativeEvent: { isComposing } as unknown as Event,
  } as unknown as KeyboardEvent<HTMLInputElement>;
}

beforeEach(() => {
  queryClient.clear();
});

afterEach(() => {
  queryClient.clear();
  vi.restoreAllMocks();
});

describe('useCreateFolderCard', () => {
  it('엔터로 제출한다', async () => {
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () => {
        requested = true;
        return HttpResponse.json(
          { status: 201, message: 'ok', data: { id: 'new' }, timestamp: '' },
          { status: 201 }
        );
      })
    );
    const { result } = renderHook(() => useCreateFolderCard(), { wrapper: Wrapper });

    act(() => result.current.setName('새 폴더'));
    await act(async () => result.current.handleKeyDown(keyEvent('Enter')));

    await waitFor(() => expect(requested).toBe(true));
  });

  it('IME 조합 중 엔터는 무시한다', () => {
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () => {
        requested = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const { result } = renderHook(() => useCreateFolderCard(), { wrapper: Wrapper });

    act(() => result.current.setName('한글입력중'));
    act(() => result.current.handleKeyDown(keyEvent('Enter', true)));

    expect(requested).toBe(false);
  });

  it('Escape는 creating을 닫고 입력을 비운다', () => {
    const { result } = renderHook(() => useCreateFolderCard(), { wrapper: Wrapper });

    act(() => result.current.startCreating());
    act(() => result.current.setName('쓰다 만 이름'));
    act(() => result.current.handleKeyDown(keyEvent('Escape')));

    expect(result.current.creating).toBe(false);
    expect(result.current.name).toBe('');
  });

  it('생성 요청 진행 중에는 blur해도 닫지 않는다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), async () => {
        await new Promise(() => {}); // pending 유지 - isPending 동안의 blur 가드만 확인
      })
    );
    const { result } = renderHook(() => useCreateFolderCard(), { wrapper: Wrapper });

    act(() => result.current.startCreating());
    act(() => result.current.setName('폴더'));
    act(() => {
      void result.current.submit();
    });

    await waitFor(() => expect(result.current.isPending).toBe(true));
    act(() => result.current.handleBlur());

    expect(result.current.creating).toBe(true);
  });

  it('입력이 비어 있고 진행 중이 아니면 blur로 닫힌다', () => {
    const { result } = renderHook(() => useCreateFolderCard(), { wrapper: Wrapper });

    act(() => result.current.startCreating());
    act(() => result.current.handleBlur());

    expect(result.current.creating).toBe(false);
  });

  it('생성에 성공하면 creating이 접힌다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () =>
        HttpResponse.json(
          { status: 201, message: 'ok', data: { id: 'new' }, timestamp: '' },
          { status: 201 }
        )
      )
    );
    const { result } = renderHook(() => useCreateFolderCard(), { wrapper: Wrapper });

    act(() => result.current.startCreating());
    act(() => result.current.setName('새 폴더'));
    await act(async () => result.current.submit());

    await waitFor(() => expect(result.current.creating).toBe(false));
  });
});
