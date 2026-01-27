import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useLoginMutation } from '@/domains/auth/_common/api/auth.queries';
import { TEXTS } from '@/shared/config/texts';
import { loginSchema, LoginRequest } from '@/domains/auth/_common/model/auth.schema';
import { ApiError } from '@/shared/types/common.type';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';

interface UseLoginReturn {
  form: UseFormReturn<LoginRequest>;
  onSubmit: (data: LoginRequest) => Promise<void>;
  isPending: boolean;
}

export function useLogin(): UseLoginReturn {
  const form = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'test@example.com',
      password: 'temp-password-1234',
    },
  });

  const { mutateAsync: login, isPending, isError } = useLoginMutation();

  const handleLoginError = (error: unknown) => {
    console.error(TEXTS.messages.error.loginError, error);

    // ApiError 타입인 경우 처리
    if (error instanceof ApiError) {
      // 401 Unauthorized: 아이디/비번 불일치 -> 비밀번호 필드에 에러 표시
      if (error.status === 401) {
        // ApiErrorResponse 구조 { code, message, error }에 맞춰 message 접근
        const errorMessage = error.data.message;

        form.setError('password', {
          type: 'manual',
          message: errorMessage,
        });
        form.setFocus('password'); // 사용자가 바로 수정할 수 있게 포커스 이동
        return;
      }
    }

    // 일반적인 에러는 폼 전체(root) 에러로 설정
    const errorMessage = error instanceof Error ? error.message : TEXTS.messages.error.loginFailed;
    form.setError('root', {
      type: 'manual',
      message: errorMessage,
    });
  };

  const isDelayPending = useMinimumLoading(isPending, 3000, isError); // 최소 로딩 시간 보장 ( 로딩 후 중간에 로그인 텍스트 깜빡임 방지)

  const onSubmit = async (data: LoginRequest) => {
    try {
      await login(data);

      // 성공 로직은 useLoginMutation 내부(onSuccess)에서 처리됨
    } catch (error) {
      handleLoginError(error);
    }
  };

  return {
    form,
    onSubmit,
    isPending: isDelayPending,
  };
}
