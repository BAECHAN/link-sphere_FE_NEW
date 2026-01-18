import {
  useMutation,
  type MutationFunctionContext,
  type UseMutationOptions,
} from '@tanstack/react-query';

type OnErrorHandler<TError, TVariables, TContext> = (
  error: TError,
  vars: TVariables,
  onMutateResult: unknown,
  context: TContext | MutationFunctionContext
) => void | Promise<void>;

type OnSuccessHandler<TData, TVariables, TContext> = (
  data: TData,
  vars: TVariables,
  onMutateResult: unknown,
  context: TContext | MutationFunctionContext
) => void | Promise<void>;

function mergeHandlers<TData, TError, TVariables, TContext>(
  options?: UseMutationOptions<TData, TError, TVariables, TContext>
): UseMutationOptions<TData, TError, TVariables, TContext> & {
  onError: OnErrorHandler<TError, TVariables, TContext>;
  onSuccess: OnSuccessHandler<TData, TVariables, TContext>;
} {
  const defaultOnError: OnErrorHandler<TError, TVariables, TContext> = (
    error: unknown,
    _vars: TVariables,
    _onMutateResult: unknown,
    _context: TContext | MutationFunctionContext
  ) => {
    // 공통 에러 로깅 (필요 시 Sentry 등 연결)
    console.error('[RQ][mutation] error:', error);
  };
  const defaultOnSuccess: OnSuccessHandler<TData, TVariables, TContext> = (
    _data: TData,
    _vars: TVariables,
    _onMutateResult: unknown,
    _context: TContext | MutationFunctionContext
  ) => {
    // 공통 후처리 지점 (예: 토스트)
  };
  return {
    ...options,
    onError: (err, vars, onMutateResult, context) => {
      defaultOnError(err, vars, onMutateResult, context);
      // forward all params
      (options?.onError as OnErrorHandler<TError, TVariables, TContext>)?.(
        err,
        vars,
        onMutateResult,
        context
      );
    },
    onSuccess: (data, vars, onMutateResult, context) => {
      defaultOnSuccess(data, vars, onMutateResult, context);
      (options?.onSuccess as OnSuccessHandler<TData, TVariables, TContext>)?.(
        data,
        vars,
        onMutateResult,
        context
      );
    },
  };
}

export function useAppMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown,
>(options: UseMutationOptions<TData, TError, TVariables, TContext>) {
  return useMutation(mergeHandlers(options));
}
