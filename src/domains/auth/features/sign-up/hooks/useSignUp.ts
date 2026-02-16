import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountSchema, CreateAccount } from '@/domains/auth/_common/model/auth.schema';
import { useCreateAccountMutation } from '@/domains/auth/_common/api/auth.queries';

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
