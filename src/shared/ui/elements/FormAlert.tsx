import { ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from '@/shared/lib/tailwind/utils';

export interface FormAlertProps {
  children: ReactNode;
  className?: string;
}

/**
 * 폼 제출이 실패했는데 특정 입력칸과는 무관할 때(요청 한도·네트워크·서버 오류 등) 제출 버튼 바로
 * 위에 남기는 안내. 입력칸 아래 에러(FormField의 text-destructive 문구)와 모양을 달리해 "폼 전체에
 * 대한 안내"로 읽히게 한다 - 시안 비교 후 박스 안(A안)으로 결정(docs/DECISIONS.md 2026-10-03).
 * 글자는 본문색이다 - 연한 빨간 배경 위 빨간 글자는 대비 4.14:1로 WCAG AA(4.5:1)에 못 미쳐
 * Storybook a11y 검사에 걸렸다. 위험 신호는 테두리·틴트·빨간 아이콘이 맡는다(A2 보정).
 *
 * 토스트와 달리 사라지지 않고 다음 제출이나 입력 수정까지 남는다. role="alert"라 화면 읽기
 * 프로그램이 나타나는 즉시 읽는다.
 *
 * @example
 * ```tsx
 * {submitError && <FormAlert>{submitError.message}</FormAlert>}
 * ```
 */
export function FormAlert({ children, className }: FormAlertProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-2.5 rounded-md border border-destructive/35 bg-destructive/8 px-3 py-2.5 text-sm font-medium text-foreground',
        className
      )}
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden="true" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
