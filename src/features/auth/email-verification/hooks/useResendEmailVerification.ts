import { useRequestEmailVerificationMutation } from '@/entities/auth/api/auth.queries';

/** MyAccountPage의 "인증 메일 다시 보내기" 버튼 전용. */
export function useResendEmailVerification(email: string) {
  const { mutate, isPending } = useRequestEmailVerificationMutation();

  const handleResend = () => {
    mutate({ email });
  };

  return { handleResend, isPending };
}
