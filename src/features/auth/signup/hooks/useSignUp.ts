import { useEffect, useState, type MouseEvent } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountSchema, CreateAccount } from '@/entities/auth/model/auth.schema';
import {
  emailValidationSchema,
  nicknameValidationSchema,
} from '@/entities/account/model/account.schema';
import { useCreateAccountMutation } from '@/entities/auth/api/auth.queries';
import { usePasswordFieldsFeedback } from '@/entities/auth/hooks/usePasswordFieldsFeedback';
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
  // 가입 성공 후 "메일함을 확인해주세요" 화면으로 전환한다(navigate 아님 -
  // useRequestPasswordReset.ts의 isSubmitted와 같은 패턴).
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<CreateAccount>({
    resolver: zodResolver(createAccountSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const { mutateAsync: createMember, isPending } = useCreateAccountMutation();
  const passwordFeedback = usePasswordFieldsFeedback(form, {
    password: 'password',
    confirm: 'confirmPassword',
  });

  // 제출 요청 중(isPending)엔 dirty로 안 잡는다 - 실패하면 isPending이 false로 돌아오면서
  // 이 조건이 다시 true가 돼 자동으로 재등록된다. isSubmitted도 함께 봐야 한다 - 이 훅은
  // 렌더마다 반응형으로 다시 평가되므로, isSubmitted 없이 isDirty만 보면 제출 성공 뒤
  // onSubmit의 clearNow()가 지운 걸 바로 다음 렌더의 이 effect가 form.formState.isDirty가
  // 여전히 true라는 이유로 재등록해버린다(브라우저 beforeunload 경고가 살아있는 채로
  // "메일함을 확인해주세요" 화면에 남는 버그로 실제 재현됨).
  const { clearNow } = useUnsavedChanges(
    'auth-signup',
    form.formState.isDirty && !isPending && !isSubmitted
  );

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
    await createMember(data);
    // 폼이 여전히 dirty해도("로그인하러 가기" 클릭 시) 이탈 가드가 뜨지 않도록 성공한
    // 뒤에만 지운다 - 실패하면 이 줄에 도달하지 않아 폼에 그대로 남는다.
    clearNow();
    setIsSubmitted(true);
  };

  const onFormReset = () => {
    form.reset(DEFAULT_VALUES);
  };

  // 이메일이 이미 가입된 것으로 확인됐을 때만 로그인 링크가 확인창 없이 바로 이동한다 -
  // 그 외(단순히 입력 중인 상태)엔 일반 네비게이션으로 흘려보내 전역 가드가 그대로
  // 처리하게 둔다(뒤로가기와 동일하게 "회원가입을 그만둘까요?" 확인창). 새 탭/창으로
  // 여는 수정키 클릭은 이 페이지에 그대로 남으므로 지우지 않는다.
  const onLoginLinkClick = (event: MouseEvent<HTMLAnchorElement>) => {
    if (!emailCheck.isDuplicate) {
      return;
    }
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    clearNow();
  };

  // 로그인 페이지로 넘어갈 때 이미 확인된 이메일을 다시 치지 않도록 location.state로
  // 함께 전달한다(useLogin.ts에서 저장된 이메일보다 우선 적용). 중복 확인 전(단순 입력
  // 중)엔 아직 그 이메일로 로그인할지 알 수 없으므로 넘기지 않는다.
  const loginLinkState = emailCheck.isDuplicate ? { email: watchedEmail } : undefined;
  const postSignupLoginState = { email: watchedEmail };

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
    isSubmitted,
    onFormReset,
    emailCheck,
    nicknameCheck,
    passwordFeedback,
    isSubmitDisabled,
    onLoginLinkClick,
    loginLinkState,
    postSignupLoginState,
  };
}
