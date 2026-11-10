import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { useNewFolderInput } from '@/features/bookmark/select/hooks/useNewFolderInput';

let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

beforeEach(() => {
  queryClient = createTestQueryClient();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useNewFolderInput', () => {
  it('같은 이름의 폴더가 이미 있으면 중복 안내를 띄우고 입력을 지우지 않는다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () =>
        HttpResponse.json(
          {
            status: 409,
            code: SERVER_ERROR_CODE.DUPLICATE_FOLDER_NAME,
            message: '',
            timestamp: '',
          },
          { status: 409 }
        )
      )
    );
    const errorSpy = vi.spyOn(toast, 'error');
    const onCreated = vi.fn();
    const { result } = renderHook(() => useNewFolderInput({ onCreated }), {
      wrapper: Wrapper,
    });

    act(() => result.current.setNewFolderName('폴더'));
    await act(async () => result.current.handleCreateAndSelect());

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderNameDuplicate)
    );
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(onCreated).not.toHaveBeenCalled();
    expect(result.current.newFolderName).toBe('폴더');
  });

  it('응답을 끝내 못 받으면 실패라고 단정하지 않는다', async () => {
    server.use(http.post(url(API_ENDPOINTS.bookmark.folders), () => HttpResponse.error()));
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useNewFolderInput({ onCreated: vi.fn() }), {
      wrapper: Wrapper,
    });

    act(() => result.current.setNewFolderName('폴더'));
    await act(async () => result.current.handleCreateAndSelect());

    await waitFor(() => expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.outcomeUnknown));
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('그 밖의 실패는 지금처럼 생성 실패 안내를 띄운다', async () => {
    server.use(
      http.post(url(API_ENDPOINTS.bookmark.folders), () =>
        HttpResponse.json(
          { status: 500, code: 'SERVER_ERROR', message: '', timestamp: '' },
          { status: 500 }
        )
      )
    );
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useNewFolderInput({ onCreated: vi.fn() }), {
      wrapper: Wrapper,
    });

    act(() => result.current.setNewFolderName('폴더'));
    await act(async () => result.current.handleCreateAndSelect());

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderCreateFailedFull)
    );
  });
});
