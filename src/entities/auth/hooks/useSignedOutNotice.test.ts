import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSignedOutNotice } from '@/entities/auth/hooks/useSignedOutNotice';
import { useAuthStore } from '@/shared/store/auth.store';
import { TEXTS } from '@/shared/config/texts';

describe('useSignedOutNotice', () => {
  it('로그인이 풀린 채 그 화면에 남아 있고 쓴 내용이 있으면 안내한다 - 만료·다른 탭 로그아웃 모두', () => {
    useAuthStore.getState().setAuth('token');
    const { result, rerender } = renderHook(({ isWriting }) => useSignedOutNotice(isWriting), {
      initialProps: { isWriting: true },
    });

    expect(result.current).toBeNull();

    act(() => useAuthStore.getState().expireSession('/post/submit'));

    expect(result.current).toBe(TEXTS.messages.error.signedOutBeforeSave);

    act(() => useAuthStore.getState().setAuth('token'));
    act(() => useAuthStore.getState().clearLocalAuthInPlace('/post/submit'));

    expect(result.current).toBe(TEXTS.messages.error.signedOutBeforeSave);

    rerender({ isWriting: false });

    expect(result.current).toBeNull();
  });

  it('다시 로그인하면 사라진다', () => {
    useAuthStore.getState().expireSession('/post/submit');
    const { result } = renderHook(() => useSignedOutNotice(true));

    expect(result.current).toBe(TEXTS.messages.error.signedOutBeforeSave);

    act(() => useAuthStore.getState().setAuth('token'));

    expect(result.current).toBeNull();
  });

  it('평소대로 로그아웃한 상태(그 화면에 두지 않음)에서는 안내하지 않는다', () => {
    const { result } = renderHook(() => useSignedOutNotice(true));

    expect(result.current).toBeNull();
  });
});
