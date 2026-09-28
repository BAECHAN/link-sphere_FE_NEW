import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  passwordResetRequestSchema,
  PasswordResetRequest,
} from '@/entities/auth/model/auth.schema';
import { useRequestPasswordResetMutation } from '@/entities/auth/api/auth.queries';

const DEFAULT_VALUES = { email: '' };

export function useRequestPasswordReset() {
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<PasswordResetRequest>({
    resolver: zodResolver(passwordResetRequestSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const { mutateAsync: requestReset, isPending } = useRequestPasswordResetMutation();

  const onSubmit = async (data: PasswordResetRequest) => {
    await requestReset(data);
    // 서버가 계정 존재 여부와 무관하게 항상 200을 반환하므로, 실패(네트워크·429 등)가 아니면
    // 무조건 "메일함을 확인해주세요" 상태로 전환한다.
    setIsSubmitted(true);
  };

  // "다시 보내기" - 이미 제출된 이메일 값을 그대로 재사용해 같은 요청을 한 번 더 보낸다.
  const handleResend = () => {
    void onSubmit(form.getValues());
  };

  return { form, onSubmit, isPending, isSubmitted, handleResend };
}
