import { type ReactNode } from 'react';
import { act, render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { QueryCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, type MemoryRouterProps } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import {
  QUERY_ERROR_POLICY,
  isUnwatchedQueryFailure,
  resolveErrorToast,
} from '@/shared/lib/react-query/config/error-toast';
import { shouldRetryQuery } from '@/shared/lib/react-query/config/retry-policy';

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
      // retry는 mutation마다 선언하고(docs/FE-ARCHITECTURE.md §28) 재전송은 기다리지 않는다 - waitFor 기본 대기가 1초다
      mutations: { retry: 0, retryDelay: 0 },
    },
  });
}

/**
 * 운영 queryClient.ts와 같은 재시도 정책·조회 에러 토스트 판정을 쓰는 QueryClient. 토스트를 띄우는 대신
 * 띄웠을 문구를 errorToasts에 모은다 - 조회 실패가 토스트로 이어지는지 셀 때 쓴다. 재시도는 기다리지 않는다.
 */
export function createQueryClientWithErrorToasts() {
  const errorToasts: string[] = [];
  const queryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        if (isUnwatchedQueryFailure(query)) {
          return;
        }

        const decision = resolveErrorToast(error, query.meta, QUERY_ERROR_POLICY);

        if (!decision.silent) {
          errorToasts.push(decision.message);
        }
      },
    }),
    defaultOptions: { queries: { retry: shouldRetryQuery, retryDelay: 0, gcTime: Infinity } },
  });

  return { queryClient, errorToasts };
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

/**
 * 실제 시간으로 ms만큼 기다리되 step마다 act를 끝내 그 사이 생긴 렌더를 그린다. act는 안에서 생긴 렌더를 범위가
 * 끝날 때까지 모아 두므로, 한 번에 길게 기다리면 요청이 도는 동안의 렌더('요청 중')를 건너뛰고 응답 뒤 상태만
 * 그린다 - 그 변화에 반응하는 effect(무한 스크롤 등)를 브라우저처럼 재현하려면 step을 응답 지연보다 짧게 둔다.
 */
export async function waitRenderingEachStep(ms: number, step = 5): Promise<void> {
  for (let elapsed = 0; elapsed < ms; elapsed += step) {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, step));
    });
  }
}

// @testing-library/react 전체 re-export → 테스트에서 이 파일 하나만 import
export * from '@testing-library/react';
export { userEvent };
