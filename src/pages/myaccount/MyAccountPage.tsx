import { Divider } from '@/shared/ui/atoms/divider';
import { ChangePasswordForm } from '@/features/auth/password-change/ui/ChangePasswordForm';
import { DeleteAccountSection } from '@/features/account/delete/ui/DeleteAccountSection';
import { TEXTS } from '@/shared/config/texts';

export function MyAccountPage() {
  return (
    <div className="w-full max-w-md mx-auto space-y-6">
      <h1 className="text-screen-title">{TEXTS.accountSettings.title}</h1>

      <div className="space-y-3">
        <h2 className="text-subsection-title">{TEXTS.accountSettings.passwordSectionTitle}</h2>
        <ChangePasswordForm />
      </div>

      <Divider />

      <DeleteAccountSection />
    </div>
  );
}
