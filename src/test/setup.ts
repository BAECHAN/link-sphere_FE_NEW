import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from '@/mocks/server';
import { useAuthStore } from '@/shared/store/auth.store';

// MSW 서버 라이프사이클
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

afterEach(() => {
  server.resetHandlers();
  cleanup();
  useAuthStore.getState().clearAuth();
});

afterAll(() => server.close());

// jsdom 미구현 Browser API 스텁

// 화살표 함수는 new로 생성할 수 없어(JS 자체의 제약), 실제 코드가 new IntersectionObserver(...)
// 처럼 생성자로 호출하면 "is not a constructor"로 터진다 - 일반 함수로 스텁해야 한다.
vi.stubGlobal(
  'IntersectionObserver',
  vi.fn(function IntersectionObserverMock() {
    return {
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
      takeRecords: vi.fn(),
    };
  })
);

vi.stubGlobal(
  'ResizeObserver',
  vi.fn(function ResizeObserverMock() {
    return {
      disconnect: vi.fn(),
      observe: vi.fn(),
      unobserve: vi.fn(),
    };
  })
);

vi.stubGlobal('matchMedia', (query: string) => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: vi.fn(),
  removeListener: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

Object.defineProperty(navigator, 'clipboard', {
  value: { writeText: vi.fn().mockResolvedValue(undefined) },
  configurable: true,
});

window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;
Element.prototype.scrollIntoView = vi.fn();

// sonner toast 모킹 — queryClient 에러 핸들러에서 toast.error() 호출 방지
// @/shared/lib/toast/toast 래퍼가 기본 toast() 호출과 dismiss도 참조하므로 함께 모킹
vi.mock('sonner', () => ({
  toast: Object.assign(vi.fn(), {
    error: vi.fn(),
    success: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
    dismiss: vi.fn(),
  }),
}));
