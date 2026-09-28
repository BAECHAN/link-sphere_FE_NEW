import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useLocation } from 'react-router-dom';
import { useLoginMutation } from '@/entities/auth/api/auth.queries';
import { loginSchema } from '@/entities/auth/model/auth.schema';
import { z } from 'zod';
import { LocalStorageUtil } from '@/shared/utils/storage.util';
import { STORAGE_KEYS } from '@/shared/config/storage-keys';

const SAVED_ID_KEY = STORAGE_KEYS.AUTH.SAVED_EMAIL;

const loginFormSchema = loginSchema.extend({
  saveEmail: z.boolean(),
});

type LoginFormInput = z.infer<typeof loginFormSchema>;

interface UseLoginReturn {
  form: UseFormReturn<LoginFormInput>;
  onSubmit: (data: LoginFormInput) => Promise<void>;
  isPending: boolean;
}

// 회원가입 화면(이메일 중복 확인 또는 가입 성공)에서 넘어올 때 함께 실리는 이메일 -
// 방금 직접 입력하고 서버가 확인해준 값이라 저장된 이메일보다 우선한다.
interface LoginLocationState {
  email?: string;
}

export function useLogin(): UseLoginReturn {
  const location = useLocation();
  const savedEmail = LocalStorageUtil.getItem<string>(SAVED_ID_KEY) || '';
  const emailFromState = (location.state as LoginLocationState | null)?.email;

  const form = useForm<LoginFormInput>({
    resolver: zodResolver(loginFormSchema),
    defaultValues: {
      email: emailFromState || savedEmail || '',
      password: '',
      saveEmail: !!savedEmail,
    },
  });

  const { mutateAsync: login, isPending } = useLoginMutation();

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
    isPending,
  };
}
