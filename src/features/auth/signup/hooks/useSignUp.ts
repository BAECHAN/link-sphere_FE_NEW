import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createAccountSchema,
  CreateAccount,
  emailValidationSchema,
  nicknameValidationSchema,
} from '@/shared/types/auth.type';
import { useCreateAccountMutation } from '@/entities/user/api/auth.queries';
import { authApi } from '@/entities/user/api/auth.api';
import { useAvailabilityCheck } from '@/features/auth/signup/hooks/useAvailabilityCheck';
import { TEXTS } from '@/shared/config/texts';

const DEFAULT_VALUES = {
  nickname: '',
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

  const watchedEmail = form.watch('email');
  const watchedNickname = form.watch('nickname');

  const emailCheck = useAvailabilityCheck({
    value: watchedEmail,
    schema: emailValidationSchema,
    checkFn: authApi.checkEmailAvailability,
  });
  const nicknameCheck = useAvailabilityCheck({
    value: watchedNickname,
    schema: nicknameValidationSchema,
    checkFn: authApi.checkNicknameAvailability,
  });

  // 중복을 RHF의 실제 필드 에러로 반영한다 - FormField가 에러 유무로 destructive 색을 자동
  // 적용해주므로(useUpdateProfile.ts와 동일한 방식), 별도로 색상 variant를 늘릴 필요가 없다
  useEffect(() => {
    if (emailCheck.status === 'duplicate') {
      form.setError('email', { type: 'manual', message: TEXTS.auth.signup.emailDuplicate });
    } else if (emailCheck.status === 'available') {
      form.clearErrors('email');
    }
  }, [emailCheck.status, form]);

  useEffect(() => {
    if (nicknameCheck.status === 'duplicate') {
      form.setError('nickname', {
        type: 'manual',
        message: TEXTS.messages.error.nicknameDuplicate,
      });
    } else if (nicknameCheck.status === 'available') {
      form.clearErrors('nickname');
    }
  }, [nicknameCheck.status, form]);

  const onSubmit = async (data: CreateAccount) => {
    await createMember(data);
  };

  const onFormReset = () => {
    form.reset(DEFAULT_VALUES);
  };

  // 확인 중이거나 이미 중복으로 확인된 값으로는 제출을 막는다 - 검사가 끝나기 전에 제출되면
  // 어차피 서버가 409로 막아주지만, 여기서 미리 막아 불필요한 왕복을 줄인다.
  const isSubmitDisabled =
    isPending ||
    emailCheck.status === 'checking' ||
    emailCheck.status === 'duplicate' ||
    nicknameCheck.status === 'checking' ||
    nicknameCheck.status === 'duplicate';

  return {
    form,
    onSubmit,
    isPending,
    onFormReset,
    emailCheck,
    nicknameCheck,
    isSubmitDisabled,
  };
}
