import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useLoginMutation } from '@/domains/auth/_common/api/auth.queries';
import { loginSchema, Login } from '@/domains/auth/_common/model/auth.schema';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { useEffect } from 'react';

interface UseLoginReturn {
  form: UseFormReturn<Login>;
  onSubmit: (data: Login) => Promise<void>;
  isPending: boolean;
}

export function useLogin(): UseLoginReturn {
  const form = useForm<Login>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'newuser2@example.com',
      password: 'securepassword123!',
    },
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      form.handleSubmit(onSubmit)();
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  const { mutateAsync: login, isPending, isError } = useLoginMutation();

  const isDelayPending = useMinimumLoading(isPending, 3000, isError); // 최소 로딩 시간 보장 ( 로딩 후 중간에 로그인 텍스트 깜빡임 방지)

  const onSubmit = async (data: Login) => {
    await login(data);
  };

  return {
    form,
    onSubmit,
    isPending: isDelayPending,
  };
}
