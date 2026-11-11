import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import { TEXTS } from '@/shared/config/texts';
import { useAuthStore } from '@/shared/store/auth.store';
import { AsyncBoundary } from '@/shared/ui/elements/AsyncBoundary';

const CONTENT = 'loaded content';

describe('AsyncBoundary', () => {
  // 던질지는 테스트가 바꾼다 - 에러 화면이 풀려 다시 그릴 때 성공하는 조회를 흉내 낸다
  let shouldThrow: boolean;

  function Content() {
    if (shouldThrow) {
      throw new Error('query failed');
    }

    return <p>{CONTENT}</p>;
  }

  // 개발 빌드의 React는 렌더 중 던진 에러를 window error 이벤트로도 흘려, jsdom이 잡히지 않은 에러로 스택을 찍는다
  const preventUncaughtErrorLog = (event: ErrorEvent) => {
    event.preventDefault();
  };

  beforeEach(() => {
    shouldThrow = true;
    window.addEventListener('error', preventUncaughtErrorLog);
    // 경계가 잡은 에러를 AsyncBoundary(handleError)가 console.error로 남긴다
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    window.removeEventListener('error', preventUncaughtErrorLog);
    vi.restoreAllMocks();
  });

  it('에러 화면이 떠 있을 때 다른 탭의 로그인·로그아웃을 반영하면 에러 화면을 풀고 children을 다시 그린다', () => {
    const onReset = vi.fn();
    render(
      <AsyncBoundary onReset={onReset}>
        <Content />
      </AsyncBoundary>
    );
    expect(screen.getByText(TEXTS.errors.unexpected.title)).toBeInTheDocument();

    shouldThrow = false;
    act(() => {
      useAuthStore.getState().markAuthSynced();
    });

    expect(screen.getByText(CONTENT)).toBeInTheDocument();
    expect(screen.queryByText(TEXTS.errors.unexpected.title)).toBeNull();
    // 호출부가 실패한 캐시를 정리할 기회를 받는다(PostList의 onReset)
    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('반영한 뒤 다시 그려도 실패하면 에러 화면으로 돌아온다', () => {
    render(
      <AsyncBoundary>
        <Content />
      </AsyncBoundary>
    );

    act(() => {
      useAuthStore.getState().markAuthSynced();
    });

    expect(screen.getByText(TEXTS.errors.unexpected.title)).toBeInTheDocument();
  });

  it('호출부가 넘긴 resetKeys가 바뀌면 에러 화면을 풀고, 그대로면 다시 그려도 에러 화면이 남는다', () => {
    const { rerender } = render(
      <AsyncBoundary resetKeys={['post-1']}>
        <Content />
      </AsyncBoundary>
    );
    shouldThrow = false;

    rerender(
      <AsyncBoundary resetKeys={['post-1']}>
        <Content />
      </AsyncBoundary>
    );
    expect(screen.getByText(TEXTS.errors.unexpected.title)).toBeInTheDocument();

    rerender(
      <AsyncBoundary resetKeys={['post-2']}>
        <Content />
      </AsyncBoundary>
    );
    expect(screen.getByText(CONTENT)).toBeInTheDocument();
  });

  it('에러가 없으면 반영해도 children을 다시 마운트하지 않는다', () => {
    shouldThrow = false;
    render(
      <AsyncBoundary>
        <Content />
      </AsyncBoundary>
    );
    const contentBefore = screen.getByText(CONTENT);

    act(() => {
      useAuthStore.getState().markAuthSynced();
    });

    // 같은 DOM 노드다 - 다시 마운트됐다면 새 노드로 바뀐다
    expect(screen.getByText(CONTENT)).toBe(contentBefore);
  });
});
