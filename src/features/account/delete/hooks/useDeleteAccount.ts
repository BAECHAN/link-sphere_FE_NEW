import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { deleteAccountSchema, DeleteAccount } from '@/entities/account/model/account.schema';
import { useDeleteAccountMutation } from '@/entities/account/api/account.queries';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { TEXTS } from '@/shared/config/texts';

const DEFAULT_VALUES: DeleteAccount = { password: '' };

export function useDeleteAccount() {
  const form = useForm<DeleteAccount>({
    resolver: zodResolver(deleteAccountSchema),
    defaultValues: DEFAULT_VALUES,
    mode: 'onSubmit',
  });

  const { mutate: deleteAccount, isPending } = useDeleteAccountMutation();
  const { openConfirm } = useAlert();

  // 비밀번호 재입력(신원 확인) + 확인 다이얼로그(오클릭 방지) 이중 방어 - 성공하면
  // useDeleteAccountMutation의 onSuccess가 로그아웃·리다이렉트까지 처리하므로 여기서
  // 폼을 따로 리셋할 필요가 없다(리셋해도 볼 사람이 없다).
  const onSubmit = form.handleSubmit((data) => {
    openConfirm({
      message: TEXTS.accountSettings.deleteConfirmMessage,
      confirmText: TEXTS.accountSettings.deleteSubmit,
      onConfirm: () => {
        deleteAccount(data);
      },
    });
  });

  return { form, onSubmit, isPending };
}
