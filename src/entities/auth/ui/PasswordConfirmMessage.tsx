import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import type { PasswordConfirmStatus } from '@/entities/auth/utils/auth.util';

export interface PasswordConfirmMessageProps {
  /** 확인 칸의 aria-describedby가 가리키는 id */
  id: string;
  status: PasswordConfirmStatus;
}

const STATUS_MESSAGE: Record<PasswordConfirmStatus, string | undefined> = {
  none: undefined,
  match: TEXTS.auth.password.confirmMatch,
  mismatch: TEXTS.validation.passwordMismatch,
  required: TEXTS.validation.passwordRequired,
};

/**
 * 비밀번호 확인 칸 아래 한 줄 - 일치는 닉네임·이메일 "사용 가능"과 같은 초록 톤(아이콘 없이
 * 글자만), 불일치·빈 값 제출은 빨강. 언제 무엇을 보여줄지는 PasswordUtil.resolveConfirmStatus가
 * 정한다. 비어 있어도 항상 렌더하는 이유는 PasswordRequirementList의 문구 줄과 같다.
 */
export function PasswordConfirmMessage({ id, status }: PasswordConfirmMessageProps) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={cn(
        'text-sm font-medium pl-0.5 empty:sr-only',
        status === 'match' ? 'text-success' : 'text-destructive'
      )}
    >
      {STATUS_MESSAGE[status]}
    </p>
  );
}
