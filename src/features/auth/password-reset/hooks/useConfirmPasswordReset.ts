import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import {
  passwordResetConfirmSchema,
  PasswordResetConfirm,
} from '@/entities/auth/model/auth.schema';
import { useConfirmPasswordResetMutation } from '@/entities/auth/api/auth.queries';
import { usePasswordFieldsFeedback } from '@/entities/auth/hooks/usePasswordFieldsFeedback';
import { SERVER_ERROR_CODE } from '@/shared/config/error-code';
import { ApiError } from '@/shared/types/common.type';

export function useConfirmPasswordReset() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  // 서버가 거절한 토큰. 여부가 아니라 값으로 기억해, 주소의 토큰이 바뀌면(새 메일 링크) 다시 폼을 보인다
  const [rejectedToken, setRejectedToken] = useState<string | null>(null);

  const form = useForm<PasswordResetConfirm>({
    resolver: zodResolver(passwordResetConfirmSchema),
    // token은 화면에 입력칸으로 노출하지 않는다 - URL에서 읽은 값을 defaultValues로만
    // 심어 제출 시 함께 보낸다(등록되지 않은 필드도 defaultValues 값은 그대로 유지된다).
    defaultValues: { token, newPassword: '', confirmPassword: '' },
    mode: 'onSubmit',
  });

  const { mutateAsync: confirmReset, isPending } = useConfirmPasswordResetMutation();
  const passwordFeedback = usePasswordFieldsFeedback(form, {
    password: 'newPassword',
    confirm: 'confirmPassword',
  });

  const onSubmit = async (data: PasswordResetConfirm) => {
    // reject는 여기서 받는다. 던지면 handleSubmit 밖으로 처리되지 않은 rejection이 샌다(useSignUp.ts와 같은 처리).
    // 실패 안내 토스트는 mutation의 onError가 띄운다
    try {
      await confirmReset(data);
    } catch (error) {
      // 만료·사용된 링크는 다시 눌러도 같은 거절만 받는다 - 폼 대신 새 링크를 요청하는 카드로 바꾼다
      if (error instanceof ApiError && error.code === SERVER_ERROR_CODE.INVALID_ACTION_TOKEN) {
        setRejectedToken(data.token);
      }
    }
  };

  return {
    form,
    onSubmit,
    isPending,
    hasToken: token.length > 0,
    isTokenRejected: token === rejectedToken,
    passwordFeedback,
  };
}
