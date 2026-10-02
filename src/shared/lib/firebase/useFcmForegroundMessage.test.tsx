import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { toast } from '@/shared/lib/toast/toast';
import { useAuthStore } from '@/shared/store/auth.store';
import { useFcmForegroundMessage } from '@/shared/lib/firebase/useFcmForegroundMessage';

type MessageHandler = (payload: {
  notification?: { title?: string; body?: string };
  data?: Record<string, string>;
}) => void;

let capturedHandler: MessageHandler | undefined;

vi.mock('firebase/messaging', () => ({
  onMessage: (_messaging: unknown, handler: MessageHandler) => {
    capturedHandler = handler;
    return () => {};
  },
}));

vi.mock('@/shared/lib/firebase/firebase', () => ({ messaging: {} }));

vi.mock('@/shared/lib/toast/toast', () => ({ toast: vi.fn() }));

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(MemoryRouter, { initialEntries: ['/post'] }, children);
}

function useHookWithLocation() {
  useFcmForegroundMessage();
  return useLocation();
}

/** 마지막 toast 호출의 "보러가기" 액션을 누른다 */
function clickToastAction() {
  const calls = vi.mocked(toast).mock.calls;
  const options = calls.at(-1)?.[1] as { action?: { onClick: () => void } } | undefined;
  options?.action?.onClick();
}

describe('useFcmForegroundMessage', () => {
  beforeEach(() => {
    capturedHandler = undefined;
    vi.mocked(toast).mockClear();
    useAuthStore.setState({ isAuthenticated: true });
  });

  afterEach(() => {
    useAuthStore.setState({ isAuthenticated: false });
  });

  it('보러가기를 누르면 그 댓글 위치(#comment-<id>)로 이동한다', async () => {
    const { result } = renderHook(() => useHookWithLocation(), { wrapper: Wrapper });
    await waitFor(() => expect(capturedHandler).toBeDefined());

    capturedHandler?.({
      notification: { title: '새로운 댓글' },
      data: { type: 'COMMENT', postId: 'post-1', commentId: 'c-9' },
    });
    clickToastAction();

    await waitFor(() => {
      expect(result.current.pathname).toBe('/post/post-1');
      expect(result.current.hash).toBe('#comment-c-9');
    });
  });

  it('commentId가 없으면 게시글로만 이동한다', async () => {
    const { result } = renderHook(() => useHookWithLocation(), { wrapper: Wrapper });
    await waitFor(() => expect(capturedHandler).toBeDefined());

    capturedHandler?.({ notification: { title: '새로운 댓글' }, data: { postId: 'post-1' } });
    clickToastAction();

    await waitFor(() => {
      expect(result.current.pathname).toBe('/post/post-1');
      expect(result.current.hash).toBe('');
    });
  });
});
