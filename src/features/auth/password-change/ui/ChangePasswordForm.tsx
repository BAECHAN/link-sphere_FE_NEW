import { FormProvider } from 'react-hook-form';
import { Button } from '@/shared/ui/atoms/button';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';
import { TEXTS } from '@/shared/config/texts';
import { useChangePassword } from '@/features/auth/password-change/hooks/useChangePassword';

export function ChangePasswordForm() {
  const { form, onSubmit, isPending } = useChangePassword();

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormInputPassword
          name="currentPassword"
          label={TEXTS.labels.currentPassword}
          required
          disabled={isPending}
          placeholder={TEXTS.placeholders.password}
        />
        <FormInputPassword
          name="newPassword"
          label={TEXTS.labels.newPassword}
          required
          disabled={isPending}
          placeholder={TEXTS.placeholders.password}
          description={TEXTS.descriptions.passwordGuide}
        />
        <FormInputPassword
          name="confirmPassword"
          label={TEXTS.labels.confirmPassword}
          required
          disabled={isPending}
          placeholder={TEXTS.placeholders.confirmPassword}
        />
        <Button type="submit" className="w-full h-11" disabled={isPending}>
          {isPending
            ? TEXTS.accountSettings.changePasswordSubmitting
            : TEXTS.accountSettings.changePasswordSubmit}
        </Button>
      </form>
    </FormProvider>
  );
}
