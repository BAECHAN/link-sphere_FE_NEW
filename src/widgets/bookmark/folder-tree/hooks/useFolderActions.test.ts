import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { createElement, type KeyboardEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { server } from '@/mocks/server';
import { API_BASE_URL, API_ENDPOINTS } from '@/shared/config/api';
import { toast } from '@/shared/lib/toast/toast';
import { TEXTS } from '@/shared/config/texts';
import { useAlertStore } from '@/shared/ui/elements/dialog/alert/alert.store';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { useFolderActions } from '@/widgets/bookmark/folder-tree/hooks/useFolderActions';

let queryClient: QueryClient;

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
  queryClient = createTestQueryClient();
});

afterEach(() => {
  useAlertStore.setState({ alerts: [] });
  vi.restoreAllMocks();
});

describe('useFolderActions — 고정', () => {
  it.each([
    { label: '고정 안 된 폴더는 PUT', pinnedAt: null, method: 'PUT' },
    { label: '고정된 폴더는 DELETE', pinnedAt: '2026-10-26T12:00:00', method: 'DELETE' },
  ])('$label 으로 /pin을 부른다', async ({ pinnedAt, method }) => {
    let requestedMethod: string | undefined;
    const folder = { ...mockBookmarkFolder, pinnedAt };
    const respond = ({ request }: { request: Request }) => {
      requestedMethod = request.method;
      return HttpResponse.json(
        { status: 200, message: 'ok', data: { id: folder.id, pinnedAt: null }, timestamp: '' },
        { status: 200 }
      );
    };
    server.use(
      http.put(url(API_ENDPOINTS.bookmark.folderPin(folder.id)), respond),
      http.delete(url(API_ENDPOINTS.bookmark.folderPin(folder.id)), respond)
    );
    const { result } = renderHook(() => useFolderActions({ folder }), { wrapper: Wrapper });

    expect(result.current.isPinned).toBe(pinnedAt !== null);

    act(() => {
      result.current.queuePinToggle();
      result.current.handleMenuCloseAutoFocus();
    });

    await waitFor(() => expect(requestedMethod).toBe(method));
  });

  // ⋮ 메뉴에서 고른 순간이 아니라 메뉴가 다 닫힌 뒤에 보낸다(docs/BOOKMARK.md §5)
  it('메뉴에서 고르기만 하고 메뉴가 아직 안 닫혔으면 요청을 보내지 않는다', async () => {
    const onPin = vi.fn();
    server.use(
      http.put(url(API_ENDPOINTS.bookmark.folderPin(mockBookmarkFolder.id)), () => {
        onPin();
        return HttpResponse.json({}, { status: 200 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.queuePinToggle();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(onPin).not.toHaveBeenCalled();
  });

  it('고정을 고르지 않고 메뉴만 닫으면 요청을 보내지 않고, 한 번 고르면 한 번만 보낸다', async () => {
    const onPin = vi.fn();
    server.use(
      http.put(url(API_ENDPOINTS.bookmark.folderPin(mockBookmarkFolder.id)), () => {
        onPin();
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { id: mockBookmarkFolder.id, pinnedAt: '2026-10-27T12:00:00' },
            timestamp: '',
          },
          { status: 200 }
        );
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.handleMenuCloseAutoFocus();
    });
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onPin).not.toHaveBeenCalled();

    act(() => {
      result.current.queuePinToggle();
      result.current.handleMenuCloseAutoFocus();
      result.current.handleMenuCloseAutoFocus();
    });

    await waitFor(() => expect(onPin).toHaveBeenCalledTimes(1));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(onPin).toHaveBeenCalledTimes(1);
  });
});

describe('useFolderActions — 이름 변경', () => {
  it('15자를 넘기면 요청 없이 편집을 열어 둔 채 이유를 보여 준다', async () => {
    let requested = false;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName('가'.repeat(16));
    });
    await act(async () => result.current.submitRename());

    expect(requested).toBe(false);
    expect(result.current.renaming).toBe(true);
    expect(result.current.name).toBe('가'.repeat(16));
    expect(result.current.nameError).toBe('폴더 이름은 15자까지 쓸 수 있어요. (지금 16자)');
  });

  it('이미 15자를 넘는 예전 이름은 고치지 않고 닫으면 그대로 닫힌다', async () => {
    const longNamedFolder = { ...mockBookmarkFolder, name: '가'.repeat(20) };
    const { result } = renderHook(() => useFolderActions({ folder: longNamedFolder }), {
      wrapper: Wrapper,
    });

    act(() => result.current.startRename());
    await act(async () => result.current.submitRename());

    expect(result.current.renaming).toBe(false);
  });

  it('이름을 바꿔 제출하면 PATCH가 나가고 편집 모드가 닫힌다', async () => {
    let requestedBody: unknown;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), async ({ request }) => {
        requestedBody = await request.json();
        return HttpResponse.json(
          {
            status: 200,
            message: 'ok',
            data: { ...mockBookmarkFolder, name: '새 이름' },
            timestamp: '',
          },
          { status: 200 }
        );
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
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
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName('   ');
    });
    await act(async () => result.current.submitRename());

    expect(requested).toBe(false);
    expect(result.current.renaming).toBe(false);
    expect(result.current.name).toBe(mockBookmarkFolder.name);
  });

  it('이름이 그대로면 요청을 보내지 않는다', async () => {
    let requested = false;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
      wrapper: Wrapper,
    });

    act(() => {
      result.current.startRename();
      result.current.setName(mockBookmarkFolder.name);
    });
    await act(async () => result.current.submitRename());

    expect(requested).toBe(false);
  });

  it('IME 조합 중 엔터는 무시한다', async () => {
    let requested = false;
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 200 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
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
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
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
    expect(result.current.name).toBe(mockBookmarkFolder.name);
  });

  it('PATCH가 실패하면 토스트를 띄우고 입력값을 원래 이름으로 복원한다', async () => {
    server.use(
      http.patch(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () =>
        HttpResponse.json(
          { status: 500, code: 'SERVER_ERROR', message: '', timestamp: '' },
          { status: 500 }
        )
      )
    );
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
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
    expect(result.current.name).toBe(mockBookmarkFolder.name);
  });
});

describe('useFolderActions — 삭제', () => {
  it('삭제 버튼은 즉시 DELETE를 보내지 않고 확인 모달을 연다', () => {
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
      wrapper: Wrapper,
    });

    act(() => result.current.handleDelete());

    const alerts = useAlertStore.getState().alerts;
    expect(alerts).toHaveLength(1);
    expect(alerts[0]?.type).toBe('confirm');
    expect(alerts[0]?.title).toBe(
      TEXTS.bookmark.folder.deleteConfirmTitle(mockBookmarkFolder.name)
    );
  });

  it('확인을 누르면 onBeforeDelete가 DELETE 요청보다 먼저 실행된다', async () => {
    const order: string[] = [];
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () => {
        order.push('request');
        return HttpResponse.json({}, { status: 204 });
      })
    );
    const onBeforeDelete = vi.fn(() => order.push('onBeforeDelete'));
    const { result } = renderHook(
      () => useFolderActions({ folder: mockBookmarkFolder, onBeforeDelete }),
      {
        wrapper: Wrapper,
      }
    );

    act(() => result.current.handleDelete());
    const confirmed = useAlertStore.getState().alerts[0]?.onConfirm;
    await act(async () => confirmed?.());

    expect(order).toEqual(['onBeforeDelete', 'request']);
  });

  it('onBeforeDelete를 넘기지 않아도 삭제가 동작한다', async () => {
    let requested = false;
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () => {
        requested = true;
        return HttpResponse.json({}, { status: 204 });
      })
    );
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
      wrapper: Wrapper,
    });

    act(() => result.current.handleDelete());
    const confirmed = useAlertStore.getState().alerts[0]?.onConfirm;
    await act(async () => confirmed?.());

    expect(requested).toBe(true);
  });

  it('DELETE가 실패하면 토스트를 띄운다', async () => {
    server.use(
      http.delete(url(API_ENDPOINTS.bookmark.folder(mockBookmarkFolder.id)), () =>
        HttpResponse.json(
          { status: 500, code: 'SERVER_ERROR', message: '', timestamp: '' },
          { status: 500 }
        )
      )
    );
    const errorSpy = vi.spyOn(toast, 'error');
    const { result } = renderHook(() => useFolderActions({ folder: mockBookmarkFolder }), {
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
