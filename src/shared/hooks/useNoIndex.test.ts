import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useNoIndex } from '@/shared/hooks/useNoIndex';

const findNoIndexMeta = () => document.head.querySelector('meta[name="robots"][content="noindex"]');

describe('useNoIndex', () => {
  it('마운트되면 head에 noindex 메타를 넣는다', () => {
    renderHook(() => useNoIndex());

    expect(findNoIndexMeta()).not.toBeNull();
  });

  it('언마운트되면 noindex 메타를 제거한다', () => {
    const { unmount } = renderHook(() => useNoIndex());

    unmount();

    expect(findNoIndexMeta()).toBeNull();
  });
});
