import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useLoginMutation } from '@/domains/auth/_common/api/auth.queries';
import { loginSchema } from '@/shared/types/auth.type';
import { useMinimumLoading } from '@/shared/hooks/useMinimumLoading';
import { z } from 'zod';
import { LocalStorageUtil } from '@/shared/utils/storage.util';

const SAVED_ID_KEY = 'savedLinkSphereEmail';

const loginFormSchema = loginSchema.extend({
  saveEmail: z.boolean(),
});

type LoginFormInput = z.infer<typeof loginFormSchema>;

interface UseLoginReturn {
  form: UseFormReturn<LoginFormInput>;
  onSubmit: (data: LoginFormInput) => Promise<void>;
  isPending: boolean;
}

export function useLogin(): UseLoginReturn {
  const savedEmail = LocalStorageUtil.getItem<string>(SAVED_ID_KEY) || '';

  const form = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: 'newuser3@example.com',
      password: 'sbdbwj123456!',
      saveEmail: !!savedEmail,
    },
  });

  const { mutateAsync: login, isPending, isError } = useLoginMutation();

  const isDelayPending = useMinimumLoading(isPending, 3000, isError); // 최소 로딩 시간 보장 ( 로딩 후 중간에 로그인 텍스트 깜빡임 방지)

  const onSubmit = async (data: LoginFormInput) => {
    await login({ email: data.email, password: data.password });

    if (data.saveEmail) {
      LocalStorageUtil.setItem(SAVED_ID_KEY, data.email);
    } else {
      LocalStorageUtil.removeItem(SAVED_ID_KEY);
    }
  };

  return {
    form,
    onSubmit,
    isPending: isDelayPending,
  };
}
