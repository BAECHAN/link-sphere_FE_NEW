import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/test/utils';
import { mockBookmarkFolder } from '@/mocks/fixtures/bookmark-folder.fixtures';
import { useRenameBookmarkFolder } from '@/features/bookmark/rename/hooks/useRenameBookmarkFolder';

// 저장·검증·Escape 동작은 이 훅을 감싼 useFolderActions.test.ts의 "이름 변경" 묶음이 그대로 검사한다
let queryClient: QueryClient;

function Wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  queryClient = createTestQueryClient();
});

describe('useRenameBookmarkFolder', () => {
  it('다른 곳에서 이름이 바뀐 뒤 편집을 열면 입력에 새 이름이 들어간다', () => {
    const { result, rerender } = renderHook(({ folder }) => useRenameBookmarkFolder({ folder }), {
      wrapper: Wrapper,
      initialProps: { folder: mockBookmarkFolder },
    });

    // 데스크톱에서 사이드바가 같은 폴더 이름을 바꾸면 제목 쪽에는 새 folder prop만 들어온다
    rerender({ folder: { ...mockBookmarkFolder, name: '사이드바에서 바꾼 이름' } });
    act(() => result.current.startRename());

    expect(result.current.renaming).toBe(true);
    expect(result.current.name).toBe('사이드바에서 바꾼 이름');
  });
});
