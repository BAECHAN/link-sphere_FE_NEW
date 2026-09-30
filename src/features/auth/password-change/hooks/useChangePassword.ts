import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { changePasswordSchema, ChangePassword } from '@/entities/auth/model/auth.schema';
import { useChangePasswordMutation } from '@/entities/auth/api/auth.queries';
import { usePasswordFieldsFeedback } from '@/entities/auth/hooks/usePasswordFieldsFeedback';

const DEFAULT_VALUES: ChangePassword = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

export function useChangePassword() {
  const form = useForm<ChangePassword>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const { mutate: changePassword, isPending } = useChangePasswordMutation();
  const passwordFeedback = usePasswordFieldsFeedback(form, {
    password: 'newPassword',
    confirm: 'confirmPassword',
  });

  // 폼 리셋은 컴포넌트 내부 상태 갱신이라 mutate(vars, { onSuccess })에 둔다 - 전역
  // useChangePasswordMutation의 onSuccess(토큰 갱신)와 달리 이건 언마운트 후엔 실행될
  // 필요가 없다(FE-ARCHITECTURE.md "React Query 라이프사이클 주의" 참고).
  const onSubmit = form.handleSubmit((data) => {
    changePassword(data, { onSuccess: () => form.reset(DEFAULT_VALUES) });
  });

  return { form, onSubmit, isPending, passwordFeedback };
}
