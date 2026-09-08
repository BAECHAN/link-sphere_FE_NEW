import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type KeyboardEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { useInlineCreateFolderInput } from '@/widgets/bookmark/folder-tree/hooks/useFolderTree';

// useFolderTree.ts의 다른 export(useFolderTree 루트·useFolderItem·useCreateFolderInput·
// useFolderChips)는 이 파일에서 다루지 않는다 - useFolderTree 루트는 useFolderSections
// 위임 1줄, useFolderItem은 useFolderActions.test.ts가 이미 덮는 로직의 얇은 래퍼,
// useCreateFolderInput은 분기 없는 boolean 토글, useFolderChips는 useFolderListQuery
// 위임뿐이라 각각 독립적인 테스트 가치가 낮다(docs/plans/2026-09-08-selective-test-coverage.md 참고).

let queryClient: QueryClient;

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
  queryClient = createTestQueryClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useInlineCreateFolderInput', () => {
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
    const onClose = vi.fn();
    const { result } = renderHook(() => useInlineCreateFolderInput(onClose), { wrapper: Wrapper });

    act(() => result.current.setName('새 폴더'));
    await act(async () => {
      result.current.handleKeyDown(keyEvent('Enter'));
    });

    await waitFor(() => expect(requested).toBe(true));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('IME 조합 중 엔터는 무시한다', () => {
    let requested = false;
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () => {
        requested = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const { result } = renderHook(() => useInlineCreateFolderInput(vi.fn()), { wrapper: Wrapper });

    act(() => result.current.setName('한글입력중'));
    act(() => result.current.handleKeyDown(keyEvent('Enter', true)));

    expect(requested).toBe(false);
  });

  it('Escape는 onClose를 호출한다', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useInlineCreateFolderInput(onClose), { wrapper: Wrapper });

    act(() => result.current.handleKeyDown(keyEvent('Escape')));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('입력이 비었을 때 blur하면 onClose를 호출한다', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useInlineCreateFolderInput(onClose), { wrapper: Wrapper });

    act(() => result.current.handleBlur());

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('입력이 남아 있으면 blur해도 닫히지 않는다', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useInlineCreateFolderInput(onClose), { wrapper: Wrapper });

    act(() => result.current.setName('입력 중'));
    act(() => result.current.handleBlur());

    expect(onClose).not.toHaveBeenCalled();
  });
});
