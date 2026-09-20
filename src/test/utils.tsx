import { type ReactNode } from 'react';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import userEvent from '@testing-library/user-event';

/**
 * 테스트용 QueryClient 생성.
 * - retry: 0 → 에러 시 재시도 없음 (테스트 타임아웃 방지)
 * - staleTime: 0 → 항상 새로운 데이터 페치 (테스트 격리)
 * - gcTime: 0(기본) → 캐시 즉시 삭제 (테스트 간 데이터 오염 방지)
 *
 * @param overrides.gcTime setQueryData로 캐시를 직접 심고 나중에 getQueryData로 검증하는
 *   테스트는 Infinity를 넘긴다 — 기본값 0이면 옵저버 없는 쿼리가 다음 틱에 즉시 수거된다
 *   (query-core의 Removable.scheduleGc: isValidTimeout(0)이 true로 취급됨).
 * @param overrides.staleTime setQueryData로 심은 캐시를 그대로 쓰고 백그라운드 재조회를
 *   일으키고 싶지 않은 테스트는 Infinity를 넘긴다 — 기본값 0이면 refetchOnMount(기본 true)가
 *   마운트 직후 재조회를 띄워 응답 객체로 참조가 바뀌고, 그 값에 의존하는 effect가 재실행된다.
 */
export function createTestQueryClient(overrides?: {
  gcTime?: number;
  staleTime?: number;
}): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: 0, staleTime: overrides?.staleTime ?? 0, gcTime: overrides?.gcTime ?? 0 },
      mutations: { retry: 0 },
    },
  });
}

interface WrapperOptions {
  /** MemoryRouter 초기 경로 */
  initialEntries?: MemoryRouterProps['initialEntries'];
  /** 외부에서 QueryClient 상태를 검사할 때 직접 주입 */
  queryClient?: QueryClient;
  /**
   * RouterProvider.tsx의 v7_startTransition 등 프로덕션 라우터 future 플래그를 재현해야
   * 하는 테스트(정지 구간·suspense 타이밍 검증)에서만 지정한다. 생략하면 기존 테스트와
   * 동일하게 미지정 상태로 렌더된다.
   */
  future?: MemoryRouterProps['future'];
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
  const { initialEntries = ['/'], queryClient = createTestQueryClient(), future } = wrapperOptions;

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries} future={future}>
          {children}
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), queryClient };
}

// @testing-library/react 전체 re-export → 테스트에서 이 파일 하나만 import
export * from '@testing-library/react';
export { userEvent };
