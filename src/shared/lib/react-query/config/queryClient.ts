import { MutationCache, QueryCache, QueryClient, type Mutation } from '@tanstack/react-query';
import { toast } from '@/shared/lib/toast/toast';
import {
  resolveErrorToast,
  MUTATION_ERROR_POLICY,
  QUERY_ERROR_POLICY,
  type CustomMutationMeta,
} from '@/shared/lib/react-query/config/error-toast';

/** 판정된 결과를 실제로 적용한다 — 토스트·콘솔 부수 효과는 이 한 곳에만 있다. */
const applyErrorToast = (decision: ReturnType<typeof resolveErrorToast>) => {
  if (decision.silent) {
    return;
  }

  if (decision.log) {
    console.error(...decision.log);
  }

  toast.error(decision.message);
};

/**
 * Mutation 에러 핸들러
 */
const mutationErrorHandler = (
  error: Error,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>
) => {
  // interface는 Record<string, unknown>에 대한 암묵적 인덱스 시그니처가 없어
  // Register['mutationMeta'] 조건부 타입이 CustomMutationMeta로 좁혀지지 않는다
  // (캐스팅을 지우면 meta가 Record<string, unknown>으로 폴백됨 — 이 파일 3곳 공통).
  const meta = mutation.meta as CustomMutationMeta | undefined;

  applyErrorToast(resolveErrorToast(error, meta, MUTATION_ERROR_POLICY));
};

/**
 * Mutation 성공 핸들러
 */
const mutationSuccessHandler = (
  _data: unknown,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>
) => {
  const meta = mutation.meta as CustomMutationMeta | undefined;

  if (meta?.successMessage) {
    toast.success(meta.successMessage);
  }
};

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      const meta = query.meta as CustomMutationMeta | undefined;

      applyErrorToast(resolveErrorToast(error, meta, QUERY_ERROR_POLICY));
    },
  }),
  mutationCache: new MutationCache({
    onError: mutationErrorHandler,
    onSuccess: mutationSuccessHandler,
  }),
  defaultOptions: {
    queries: {
      staleTime: 3 * 60 * 1000, // 3분
      gcTime: 5 * 60 * 1000, // 5분
      retry: 1,
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      throwOnError: false, // ErrorBoundary 사용 시 true로 변경
    },
  },
});
