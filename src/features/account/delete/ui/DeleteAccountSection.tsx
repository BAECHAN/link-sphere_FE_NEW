import { FormProvider } from 'react-hook-form';
import { Button } from '@/shared/ui/atoms/button';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';
import { TEXTS } from '@/shared/config/texts';
import { useDeleteAccount } from '@/features/account/delete/hooks/useDeleteAccount';

export function DeleteAccountSection() {
  const { form, onSubmit, isPending } = useDeleteAccount();

  return (
    <div className="rounded-lg border border-destructive/30 p-4 space-y-4">
      <div className="space-y-1">
        <h2 className="text-subsection-title text-destructive">
          {TEXTS.accountSettings.deleteSectionTitle}
        </h2>
        <p className="text-sm text-muted-foreground">
          {TEXTS.accountSettings.deleteSectionDescription}
        </p>
      </div>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormInputPassword
            name="password"
            label={TEXTS.labels.password}
            required
            disabled={isPending}
            placeholder={TEXTS.placeholders.password}
          />
          <Button type="submit" variant="destructive" disabled={isPending}>
            {isPending
              ? TEXTS.accountSettings.deleteSubmitting
              : TEXTS.accountSettings.deleteSubmit}
          </Button>
        </form>
      </FormProvider>
    </div>
  );
}
