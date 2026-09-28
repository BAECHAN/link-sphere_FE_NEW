import { Button } from '@/shared/ui/atoms/button';
import { useAccount } from '@/entities/account/hooks/useAccount';
import { useResendEmailVerification } from '@/features/auth/email-verification/hooks/useResendEmailVerification';
import { TEXTS } from '@/shared/config/texts';

/** 계정이 이메일 미인증 상태일 때만 렌더링되는 안내 + 재발송 버튼. */
export const EmailVerificationBanner = () => {
  const { account } = useAccount();
  const { handleResend, isPending } = useResendEmailVerification(account?.email ?? '');

  if (!account || account.emailVerified) {
    return null;
  }

  return (
    <div className="rounded-lg border border-warning/30 bg-warning/10 p-4 space-y-3">
      <p className="text-sm text-warning-foreground">
        {TEXTS.accountSettings.emailVerificationNeeded}
      </p>
      <Button variant="outline" size="sm" disabled={isPending} onClick={handleResend}>
        {isPending
          ? TEXTS.accountSettings.emailVerificationResending
          : TEXTS.accountSettings.emailVerificationResend}
      </Button>
    </div>
  );
};
