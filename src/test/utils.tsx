import { type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

/**
 * 테스트용 QueryClient 생성.
 * - retry: 0 → 에러 시 재시도 없음 (테스트 타임아웃 방지)
 * - staleTime: 0 → 항상 새로운 데이터 페치 (테스트 격리)
 * - gcTime: 0 → 캐시 즉시 삭제 (테스트 간 데이터 오염 방지)
 */
export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, staleTime: 0, gcTime: 0 },
      mutations: { retry: 0 },
    },
  });
}

interface WrapperOptions {
  /** MemoryRouter 초기 경로 */
  initialEntries?: MemoryRouterProps['initialEntries'];
  /** 외부에서 QueryClient 상태를 검사할 때 직접 주입 */
  queryClient?: QueryClient;
}

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  wrapperOptions?: WrapperOptions;
}

/**
 * React Query + MemoryRouter Provider를 포함한 커스텀 render 함수.
 * 컴포넌트 테스트에서 이 함수를 사용하면 별도의 Provider 설정 없이 렌더할 수 있습니다.
 *
 * @example
 * const { getByText, queryClient } = renderWithProviders(<PostCard post={mockPost} />);
 */
export function renderWithProviders(
  ui: ReactNode,
  options: CustomRenderOptions = {}
): RenderResult & { queryClient: QueryClient } {
  const { wrapperOptions = {}, ...renderOptions } = options;
  const { initialEntries = ['/'], queryClient = createTestQueryClient() } = wrapperOptions;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

// @testing-library/react 전체 re-export → 테스트에서 이 파일 하나만 import
export * from '@testing-library/react';
export { userEvent };
