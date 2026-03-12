import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountSchema, CreateAccount } from '@/shared/types/auth.type';
import { useCreateAccountMutation } from '@/entities/user/api/auth.queries';

const DEFAULT_VALUES = {
  name: '',
  email: '',
  password: '',
};

export function useSignUp() {
  const form = useForm<CreateAccount>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const { mutateAsync: createMember, isPending } = useCreateAccountMutation();

  const onSubmit = async (data: CreateAccount) => {
    await createMember(data);
  };

  const onFormReset = () => {
    form.reset(DEFAULT_VALUES);
  };

  return {
    form,
    onSubmit,
    isPending,
    onFormReset,
  };
}
