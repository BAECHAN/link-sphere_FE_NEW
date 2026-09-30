import { Check, Circle, X, type LucideIcon } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';
import { TEXTS } from '@/shared/config/texts';
import { PASSWORD_REQUIREMENTS, type PasswordRequirement } from '@/entities/auth/config/auth.const';
import type { PasswordRequirementState } from '@/entities/auth/utils/auth.util';

export interface PasswordRequirementListProps {
  /** 비밀번호 입력칸의 aria-describedby가 가리키는 체크리스트 id */
  id: string;
  /** 금지 입력·빈 값 제출 문구 줄의 id */
  messageId: string;
  states: Record<PasswordRequirement, PasswordRequirementState>;
  message?: string;
}

// 색만으로 상태를 구분하지 않도록 아이콘 모양도 다르게 둔다(WCAG 1.4.1)
const STATE_ICON: Record<PasswordRequirementState, LucideIcon> = {
  met: Check,
  unmet: X,
  pending: Circle,
};

const STATE_TONE: Record<PasswordRequirementState, string> = {
  met: 'text-success',
  unmet: 'text-destructive',
  pending: 'text-muted-foreground',
};

/**
 * 비밀번호 칸 아래 조건 체크리스트(가로 한 줄 배치 - Artifact 미리보기로 사용자 승인,
 * https://claude.ai/artifact/7msbwHbj9WtYc5ni5jycLq). 무엇을 언제 빨강으로 바꿀지는
 * PasswordUtil.resolveRequirementStates가 정하고, 여기선 그리기만 한다.
 *
 * 문구 줄은 비어 있어도 항상 렌더한다 - aria-live 영역은 내용이 바뀌기 전부터 있어야 읽힌다.
 * 비었을 땐 sr-only(절대 위치)라 FormField의 gap에 끼지 않아 자리를 차지하지 않는다.
 */
export function PasswordRequirementList({
  id,
  messageId,
  states,
  message,
}: PasswordRequirementListProps) {
  return (
    <>
      <p
        id={messageId}
        aria-live="polite"
        className="text-sm font-medium text-destructive pl-0.5 empty:sr-only"
      >
        {message}
      </p>
      <ul id={id} className="flex flex-wrap gap-x-3 gap-y-1 pl-0.5">
        {PASSWORD_REQUIREMENTS.map((requirement) => {
          const state = states[requirement];
          const Icon = STATE_ICON[state];

          return (
            <li
              key={requirement}
              data-state={state}
              className={cn('flex items-center gap-1.5 text-sm', STATE_TONE[state])}
            >
              <Icon className="size-3.5 shrink-0" aria-hidden="true" />
              <span>{TEXTS.auth.password.requirements[requirement]}</span>
              <span className="sr-only">
                {state === 'met'
                  ? TEXTS.ariaLabels.passwordRequirementMet
                  : TEXTS.ariaLabels.passwordRequirementUnmet}
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}
