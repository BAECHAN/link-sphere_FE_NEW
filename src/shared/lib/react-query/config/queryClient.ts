import { MutationCache, QueryCache, QueryClient, type Mutation } from '@tanstack/react-query';
import { ApiError } from '@/shared/types/common.type';
import { TEXTS } from '@/shared/config/texts';
import { toast } from 'sonner';
import { AuthUtil } from '@/domains/auth/_common/utils/auth.util';

// 1. 커스텀 Meta 타입 정의 (모듈 확장 대신 로컬 인터페이스 활용 고려)
interface CustomMutationMeta {
  successMessage?: string;
  errorMessage?: string;
  manualErrorHandling?: boolean;
}

// 2. 모듈 확장을 통해 React Query 타입에 반영
declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: CustomMutationMeta;
    queryMeta: CustomMutationMeta; // Query에도 동일하게 적용하고 싶다면 추가
  }
}

/**
 * Mutation 에러 핸들러
 */
const mutationErrorHandler = (
  error: Error,
  _variables: unknown,
  _context: unknown,
  mutation: Mutation<unknown, unknown, unknown, unknown>
) => {
  const meta = mutation.meta as CustomMutationMeta | undefined;

  // 1. 에러 무시 설정이 있으면 종료
  if (meta?.manualErrorHandling) {
    return;
  }

  let message: string = TEXTS.messages.error.unknownError;

  // 2. meta에 정의된 커스텀 에러 메시지가 있으면 우선 사용
  if (meta?.errorMessage) {
    message = meta.errorMessage;
  } else if (error instanceof ApiError) {
    // 401 인증 에러 처리 (로그인 필요, 유효하지 않은 토큰)
    if (error.code === 'NOT_LOGGED_IN' || error.code === 'INVALID_TOKEN') {
      AuthUtil.clearAll();
      window.location.href = '/auth/login';
      return;
    }

    // 403 권한 에러 처리
    if (error.code === 'ACCESS_DENIED') {
      toast.error(TEXTS.messages.error.accessDenied || '접근 권한이 없습니다.');
      return;
    }

    // 보안 및 UX를 위해 서버 에러 메시지를 직접 노출하지 않음
    // 상세 에러는 콘솔에 남기고 사용자에게는 일반적인 에러 메시지 표시
    console.error(`[API Mutation Error] ${error.message}`, error.data);
    message = TEXTS.messages.error.serverError;
  } else if (error instanceof Error) {
    console.error(`[Mutation Error] ${error.message}`);
    message = TEXTS.messages.error.serverError;
  }

  toast.error(message);
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

      // Query 에러 처리
      if (meta?.errorMessage) {
        toast.error(meta.errorMessage);
      } else if (error instanceof ApiError) {
        // 401 인증 에러 처리 (로그인 필요, 유효하지 않은 토큰)
        if (error.code === 'NOT_LOGGED_IN' || error.code === 'INVALID_TOKEN') {
          AuthUtil.clearAll();
          toast.error(TEXTS.messages.error.loginRequired || '로그인이 필요합니다.');
          window.location.href = '/auth/login';
          return;
        }

        // 403 권한 에러 처리
        if (error.code === 'ACCESS_DENIED') {
          toast.error(TEXTS.messages.error.accessDenied || '접근 권한이 없습니다.');
          return;
        }

        // 보안 및 UX를 위해 서버 에러 메시지를 직접 노출하지 않음
        console.error(`[API Query Error] ${error.message}`, error.data);
        toast.error(TEXTS.messages.error.serverError);
      }
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
