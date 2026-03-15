import { zodResolver } from '@hookform/resolvers/zod';
import { useForm, UseFormReturn } from 'react-hook-form';
import { useLoginMutation } from '@/entities/user/api/auth.queries';
import { loginSchema } from '@/shared/types/auth.type';
import { z } from 'zod';
import { LocalStorageUtil } from '@/shared/utils/storage.util';

const SAVED_ID_KEY = 'saved_email_linksphere';

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
      email: '',
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
