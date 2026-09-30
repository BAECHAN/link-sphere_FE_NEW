import { useEffect, useId, useState } from 'react';
import type { FieldValues, Path, UseFormReturn } from 'react-hook-form';
import { PasswordUtil, type PasswordViolation } from '@/entities/auth/utils/auth.util';
import { TEXTS } from '@/shared/config/texts';

interface PasswordFieldNames<T extends FieldValues> {
  password: Path<T>;
  confirm: Path<T>;
}

const VIOLATION_MESSAGE: Record<PasswordViolation, string> = {
  nonAscii: TEXTS.validation.passwordAsciiOnly,
  tooLong: TEXTS.validation.passwordMaxLength,
};

/**
 * 비밀번호를 새로 만드는 폼(가입·재설정·변경)의 실시간 피드백 - 비밀번호 칸 아래 조건
 * 체크리스트와 확인 칸 일치 문구를 입력값에서 바로 계산한다.
 *
 * 폼은 그대로 `mode: 'onSubmit'` + zodResolver로 둔다 - RHF 에러는 제출 차단·첫 에러 포커스·
 * 테두리만 맡고, 화면 문구는 이 훅이 계산한 상태로 그린다(hideErrorMessage). 제출 전엔 RHF가
 * 에러를 만들지 않으니 "입력 중엔 지적하지 않는다"가 자연히 지켜지고, 제출 후 비밀번호를 고치면
 * deps가 확인 칸 RHF 에러까지 다시 검증해 준다.
 *
 * 반환값은 FormInputPassword 두 개와 PasswordRequirementList·PasswordConfirmMessage에 그대로
 * 펼쳐 넘긴다(SignUpForm.tsx 참고).
 */
export function usePasswordFieldsFeedback<T extends FieldValues>(
  form: UseFormReturn<T>,
  fields: PasswordFieldNames<T>
) {
  const idPrefix = useId();
  const listId = `${idPrefix}-requirements`;
  const passwordMessageId = `${idPrefix}-password-message`;
  const confirmMessageId = `${idPrefix}-confirm-message`;

  // RHF의 touched는 한 번 켜지면 계속 켜져 있어 "지금 확인 칸을 벗어나 있는가"를 알 수 없다 -
  // 빈 확인 칸을 Tab으로 지나간 뒤 첫 글자를 치자마자 불일치가 뜨지 않도록 포커스를 따로 본다
  const [isConfirmFocused, setIsConfirmFocused] = useState(false);
  const [isConfirmLatched, setIsConfirmLatched] = useState(false);

  const password = String(form.watch(fields.password) ?? '');
  const confirm = String(form.watch(fields.confirm) ?? '');
  const { isTouched } = form.getFieldState(fields.password, form.formState);
  const { isSubmitted } = form.formState;

  const requirementStates = PasswordUtil.resolveRequirementStates(password, {
    isTouched,
    isSubmitted,
  });
  const violation = PasswordUtil.findViolation(password);
  const confirmStatus = PasswordUtil.resolveConfirmStatus({
    password,
    confirm,
    isFocused: isConfirmFocused,
    isLatched: isConfirmLatched,
    isSubmitted,
  });

  // 불일치를 한 번 보여주면 고치는 동안(글자 수가 다시 모자라도) 매 글자 판정을 이어가고,
  // 일치하거나 확인 칸을 비우면 풀어준다
  useEffect(() => {
    if (confirmStatus === 'mismatch') {
      setIsConfirmLatched(true);
    } else if (confirmStatus === 'match' || confirm === '') {
      setIsConfirmLatched(false);
    }
  }, [confirmStatus, confirm]);

  const passwordMessage = violation
    ? VIOLATION_MESSAGE[violation]
    : isSubmitted && password === ''
      ? TEXTS.validation.passwordRequired
      : undefined;
  const isPasswordInvalid =
    violation !== null || Object.values(requirementStates).includes('unmet');
  const isConfirmInvalid = confirmStatus === 'mismatch' || confirmStatus === 'required';

  return {
    passwordInputProps: {
      deps: [fields.confirm],
      hideErrorMessage: true,
      'aria-describedby': `${passwordMessageId} ${listId}`,
      'aria-invalid': isPasswordInvalid,
    },
    requirementListProps: {
      id: listId,
      messageId: passwordMessageId,
      states: requirementStates,
      message: passwordMessage,
    },
    confirmInputProps: {
      hideErrorMessage: true,
      'aria-describedby': confirmMessageId,
      'aria-invalid': isConfirmInvalid,
      onFocus: () => setIsConfirmFocused(true),
      onBlur: () => setIsConfirmFocused(false),
    },
    confirmMessageProps: {
      id: confirmMessageId,
      status: confirmStatus,
    },
  };
}
