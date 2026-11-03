import { useEffect, useState, type MouseEvent } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { createAccountSchema, CreateAccount } from '@/entities/auth/model/auth.schema';
import {
  emailValidationSchema,
  nicknameValidationSchema,
} from '@/entities/account/model/account.schema';
import { useCreateAccountMutation } from '@/entities/auth/api/auth.queries';
import { SignUpUtil, type SignUpSubmitErrorResolution } from '@/entities/auth/utils/auth.util';
import { usePasswordFieldsFeedback } from '@/entities/auth/hooks/usePasswordFieldsFeedback';
import { authApi } from '@/entities/auth/api/auth.api';
import { accountApi } from '@/entities/account/api/account.api';
import { useAvailabilityCheck } from '@/features/auth/signup/hooks/useAvailabilityCheck';
import { useUnsavedChanges } from '@/shared/hooks/useUnsavedChanges';
import { usePendingSubmit } from '@/shared/hooks/usePendingSubmit';
import { useHasLeftPage } from '@/shared/hooks/useHasLeftPage';
import { toast } from '@/shared/lib/toast/toast';
import { showLeftPageFailureToast } from '@/shared/lib/toast/LeftPageFailureToast';
import { NavigationService } from '@/shared/lib/router/navigation';
import { ROUTES_PATHS } from '@/shared/config/route-paths';
import { TEXTS } from '@/shared/config/texts';

const DEFAULT_VALUES = {
  nickname: '',
  email: '',
  password: '',
  confirmPassword: '',
};

// 떠난 뒤 가입이 실패해 토스트의 [다시 가입하기]로 돌아올 때 실리는 입력. location.state는 브라우저 방문
// 기록(history.state)에 남으므로 비밀번호는 싣지 않는다(docs/UNSAVED-CHANGES-GUARD.md §5)
interface SignUpLocationState {
  restoredInput?: { nickname: string; email: string };
}

/** 응답 전에 "나가기"로 떠난 뒤 실패했다 - 가입 폼이 없으니 닫을 때까지 남는 토스트로 알리고 돌아갈 버튼을 단다 */
function showSignUpFailedAfterLeaving(
  { reason }: SignUpSubmitErrorResolution,
  { nickname, email }: { nickname: string; email: string }
) {
  const { leftPageFailure } = TEXTS.messages.error;

  // 이미 계정이 있으니 로그인이 해결책이다 - 로그인 화면이 state.email을 채운다(useLogin.ts)
  if (reason === 'duplicateEmail') {
    showLeftPageFailureToast({
      key: 'auth-signup',
      title: leftPageFailure.signUpTitle,
      description: TEXTS.auth.signup.emailDuplicate,
      action: {
        label: TEXTS.buttons.login,
        onClick: () => NavigationService.navigate(ROUTES_PATHS.AUTH.LOGIN, { state: { email } }),
      },
    });
    return;
  }

  const restoredState: SignUpLocationState = { restoredInput: { nickname, email } };

  showLeftPageFailureToast({
    key: 'auth-signup',
    title: leftPageFailure.signUpTitle,
    description:
      reason === 'duplicateNickname'
        ? leftPageFailure.signUpDuplicateNickname
        : leftPageFailure.retryLater,
    action: {
      label: TEXTS.buttons.signUpAgain,
      onClick: () => NavigationService.navigate(ROUTES_PATHS.AUTH.SIGNUP, { state: restoredState }),
    },
  });
}

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

  // 가입 요청 중에도 dirty로 잡는다 - 응답 전에 떠나면 완료 화면을 못 봐 결과를 모르게 되므로
  // 게시글 폼처럼 확인창을 띄운다(docs/UNSAVED-CHANGES-GUARD.md §5 "저장 요청 중 이탈").
  // isSubmitted는 함께 봐야 한다 - 이 훅은 렌더마다 반응형으로 다시 평가되므로, isSubmitted 없이
  // isDirty만 보면 제출 성공 뒤 onSubmit의 clearNow()가 지운 걸 바로 다음 렌더의 이 effect가
  // form.formState.isDirty가 여전히 true라는 이유로 재등록해버린다(브라우저 beforeunload 경고가
  // 살아있는 채로 "메일함을 확인해주세요" 화면에 남는 버그로 실제 재현됨).
  const { clearNow } = useUnsavedChanges('auth-signup', form.formState.isDirty && !isSubmitted);
  usePendingSubmit('auth-signup', isPending, TEXTS.unsavedChanges.pending.signup);
  const hasLeftPage = useHasLeftPage();
  const location = useLocation();
  const restoredInput = (location.state as SignUpLocationState | null)?.restoredInput;

  useEffect(
    function restoreInputAfterLeftPageFailure() {
      // 같은 화면에 새로 입력 중이면 덮지 않는다 - 같은 경로 이동은 이탈 가드가 막지 않아 새 입력이 확인 없이
      // 사라진다. 기본값은 그대로 두고 값만 넣어 되살린 입력도 작성 중(dirty)으로 잡는다
      if (!restoredInput || form.formState.isDirty) {
        return;
      }

      form.reset({ ...DEFAULT_VALUES, ...restoredInput }, { keepDefaultValues: true });
    },
    [restoredInput, form]
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
    // reject는 여기서 받아 안내로 바꾸고 다시 던지지 않는다. 던지면 handleSubmit 밖으로 처리되지 않은
    // rejection이 샌다(react-hook-form 7.71.0은 onValid의 에러를 다시 던진다 - dist/index.esm.mjs:2194-2216,
    // useCreatePost.ts와 같은 처리)
    try {
      await createMember(data);
    } catch (error) {
      const resolution = SignUpUtil.resolveSubmitError(error);

      if (hasLeftPage()) {
        showSignUpFailedAfterLeaving(resolution, data);
        return;
      }

      // 확인과 제출 사이에 다른 사람이 같은 값으로 가입했다 - 확인 결과("사용 가능")가 남아 있으면 다시 눌러도
      // 같은 409만 받으니, 실시간 확인에서 중복이 나온 것처럼 칸 오류를 띄우고 제출을 막는다
      if (resolution.reason === 'duplicateEmail') {
        emailCheck.markDuplicate(data.email);
      } else if (resolution.reason === 'duplicateNickname') {
        nicknameCheck.markDuplicate(data.nickname);
      }

      // 화면에 머물렀으면 입력이 그대로 남아 바로 다시 시도할 수 있다
      toast.error(resolution.message);
      return;
    }

    // 응답 전에 "나가기"로 떠났으면 완료 화면을 볼 수 없다 - 그때만 토스트로 대신 알린다. clearNow보다
    // 먼저 본다: 다시 들어와 새로 연 가입 폼의 키를 지우지 않게(useCreatePost.ts와 같은 순서)
    if (hasLeftPage()) {
      toast.success(TEXTS.messages.success.signUpCompleted);
      return;
    }

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
