import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useSearchParams } from 'react-router-dom';
import {
  passwordResetConfirmSchema,
  PasswordResetConfirm,
} from '@/entities/auth/model/auth.schema';
import { useConfirmPasswordResetMutation } from '@/entities/auth/api/auth.queries';
import { usePasswordFieldsFeedback } from '@/entities/auth/hooks/usePasswordFieldsFeedback';

export function useConfirmPasswordReset() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

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
    await confirmReset(data);
  };

  return { form, onSubmit, isPending, hasToken: token.length > 0, passwordFeedback };
}
