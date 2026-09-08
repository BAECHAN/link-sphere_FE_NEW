import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type KeyboardEvent, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/shared/lib/react-query/config/queryClient';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { useAlertStore } from '@/shared/ui/elements/modal/alert/alert.store';
import { mockFolder } from '@/mocks/fixtures/folder.fixtures';
import { useFolderActions } from '@/widgets/bookmark/folder-tree/hooks/useFolderActions';

// useUpdateFolderMutation의 onMutate/onError가 싱글톤 queryClient를 직접 조작하므로
// (folder.queries.test.ts 선례) 이 파일도 같은 인스턴스를 provider로 쓴다.
function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

const url = (endpoint: string) => `${API_BASE_URL}${endpoint}`;

/** nativeEvent.isComposing만 검사하는 handleRenameKeyDown용 최소 가짜 이벤트. */
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
  useAlertStore.setState({ alerts: [] });
  vi.restoreAllMocks();
});

describe('useFolderActions — 이름 변경', () => {
  it('이름을 바꿔 제출하면 PATCH가 나가고 편집 모드가 닫힌다', async () => {
    let requestedBody: unknown;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockFolder.id)), async ({ request }) => {
        requestedBody = await request.json();
        return HttpResponse.json(
          { status: 200, message: 'ok', data: { ...mockFolder, name: '새 이름' }, timestamp: '' },
          { status: 200 }
        );
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName('새 이름');
    });
    await act(async () => result.current.submitRename());

    expect(requestedBody).toEqual({ name: '새 이름' });
    expect(result.current.renaming).toBe(false);
  });

  it('공백만 입력하면 요청 없이 원래 이름으로 되돌린다', async () => {
    let requested = false;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName('   ');
    });
    await act(async () => result.current.submitRename());

    expect(requested).toBe(false);
    expect(result.current.renaming).toBe(false);
    expect(result.current.name).toBe(mockFolder.name);
  });

  it('이름이 그대로면 요청을 보내지 않는다', async () => {
    let requested = false;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName(mockFolder.name);
    });
    await act(async () => result.current.submitRename());

    expect(requested).toBe(false);
  });

  it('IME 조합 중 엔터는 무시한다', async () => {
    let requested = false;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName('한글입력중');
    });
    await act(async () => {
      result.current.handleRenameKeyDown(keyEvent('Enter', true));
    });

    expect(requested).toBe(false);
  });

  it('Escape는 편집을 닫고 입력값을 원래 이름으로 되돌린다', () => {
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName('바꾸다 만 이름');
    });
    act(() => {
      result.current.handleRenameKeyDown(keyEvent('Escape'));
    });

    expect(result.current.renaming).toBe(false);
    expect(result.current.name).toBe(mockFolder.name);
  });

  it('PATCH가 실패하면 토스트를 띄우고 입력값을 원래 이름으로 복원한다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockFolder.id)), () =>
        HttpResponse.json(
          { status: 500, code: 'SERVER_ERROR', message: '', timestamp: '' },
          { status: 500 }
        )
      )
    );
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName('실패할 이름');
    });
    await act(async () => result.current.submitRename());

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderRenameFailed)
    );
    expect(result.current.name).toBe(mockFolder.name);
  });
});

describe('useFolderActions — 삭제', () => {
  it('삭제 버튼은 즉시 DELETE를 보내지 않고 확인 모달을 연다', () => {
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => result.current.handleDelete());

    const alerts = useAlertStore.getState().alerts;
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('confirm');
    expect(alerts[0]?.title).toBe(TEXTS.bookmark.folder.deleteConfirmTitle(mockFolder.name));
  });

  it('확인을 누르면 onBeforeDelete가 DELETE 요청보다 먼저 실행된다', async () => {
    const order: string[] = [];
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.folder(mockFolder.id)), () => {
        order.push('request');
        return HttpResponse.json({}, { status: 204 });
      })
    );
    const onBeforeDelete = vi.fn(() => order.push('onBeforeDelete'));
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder, onBeforeDelete }), {
      wrapper: Wrapper,
    });

    act(() => result.current.handleDelete());
    const confirmed = useAlertStore.getState().alerts[0]?.onConfirm;
    await act(async () => confirmed?.());

    expect(order).toEqual(['onBeforeDelete', 'request']);
  });

  it('onBeforeDelete를 넘기지 않아도 삭제가 동작한다', async () => {
    let requested = false;
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.folder(mockFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 204 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => result.current.handleDelete());
    const confirmed = useAlertStore.getState().alerts[0]?.onConfirm;
    await act(async () => confirmed?.());

    expect(requested).toBe(true);
  });

  it('DELETE가 실패하면 토스트를 띄운다', async () => {
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.folder(mockFolder.id)), () =>
        HttpResponse.json(
          { status: 500, code: 'SERVER_ERROR', message: '', timestamp: '' },
          { status: 500 }
        )
      )
    );
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useFolderActions({ folder: mockFolder }), {
      wrapper: Wrapper,
    });

    act(() => result.current.handleDelete());
    const confirmed = useAlertStore.getState().alerts[0]?.onConfirm;
    await act(async () => confirmed?.());

    await waitFor(() =>
      expect(errorSpy).toHaveBeenCalledWith(TEXTS.messages.error.folderDeleteFailed)
    );
  });
});
