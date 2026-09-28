import { useEffect, type MouseEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountSchema, CreateAccount } from '@/entities/auth/model/auth.schema';
import {
  emailValidationSchema,
  nicknameValidationSchema,
} from '@/entities/account/model/account.schema';
import { useCreateAccountMutation } from '@/entities/auth/api/auth.queries';
import { authApi } from '@/entities/auth/api/auth.api';
import { accountApi } from '@/entities/account/api/account.api';
import { useAvailabilityCheck } from '@/features/auth/signup/hooks/useAvailabilityCheck';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { TEXTS } from '@/shared/config/texts';

const DEFAULT_VALUES = {
  nickname: '',
  email: '',
  password: '',
  confirmPassword: '',
};

export function useSignUp() {
  const form = useForm<CreateAccount>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const { mutateAsync: createMember, isPending } = useCreateAccountMutation();

  // 제출 요청 중(isPending)엔 dirty로 안 잡는다 - 실패하면 isPending이 false로 돌아오면서
  // 이 조건이 다시 true가 돼 자동으로 재등록된다(성공하면 onSubmit이 요청 직전에 이미
  // clearNow로 지워둔 상태라 재등록 시점 전에 페이지를 벗어난다).
  const { clearNow } = useUnsavedChanges('auth-signup', form.formState.isDirty && !isPending);

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
    checkFn: accountApi.checkNicknameAvailability,
  });

  // 중복을 RHF의 실제 필드 에러로 반영한다 - FormField가 에러 유무로 destructive 색을 자동
  // 적용해주므로(useUpdateAccount.ts와 동일한 방식), 별도로 색상 variant를 늘릴 필요가 없다
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
    // 성공 시 useCreateAccountMutation의 onSuccess가 곧장 로그인 페이지로 이동시킨다 -
    // 요청 직전에 동기로 지워둬야 그 이동이 가드에 막히지 않는다(useCreatePost.ts와 동일 패턴).
    clearNow();
    await createMember(data);
  };

  const onFormReset = () => {
    form.reset(DEFAULT_VALUES);
  };

  // 로그인 링크로 바로 이동 - 로그인하려는 의도가 명확해 확인창을 띄우지 않는다. 단
  // 새 탭/창으로 여는 수정키 클릭은 이 페이지에 그대로 남으므로 지우지 않는다.
  const onLoginLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    clearNow();
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
    onLoginLinkClick,
  };
}
