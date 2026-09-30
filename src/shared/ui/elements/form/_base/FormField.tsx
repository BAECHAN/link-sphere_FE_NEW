import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import { Label } from '@/shared/ui/atoms/label';
import { RequiredMark } from '@/shared/ui/atoms/required-mark';
import { PropsWithChildren } from 'react';
import { cn } from '@/shared/lib/tailwind/utils';

export interface FormFieldProps extends PropsWithChildren {
  name: string;
  label?: string;
  /** true면 라벨 옆에 필수 표시(*)를 붙인다 - 실제 "필수" 안내는 input의 required 속성이 담당 */
  required?: boolean;
  className?: string;
  description?: string;
  /** description을 성공(초록) 톤으로 강조한다 - 기본은 muted */
  descriptionVariant?: 'default' | 'success';
  /** description/에러가 없을 때도 줄 높이를 미리 확보해, 메시지가 나타나고 사라질 때
   * 아래 요소(제출 버튼 등)가 밀리지 않게 한다 */
  reserveDescriptionSpace?: boolean;
  /** true면 RHF 필드 에러 문구를 그리지 않는다 - 호출자가 children으로 자체 안내(예: 비밀번호
   * 조건 체크리스트)를 그려 같은 에러를 두 번 보여주지 않게 할 때 쓴다. 에러 자체(제출 차단,
   * 첫 에러 포커스)는 그대로 동작한다 */
  hideErrorMessage?: boolean;
}

export const FormField = ({
  name,
  label,
  required,
  children,
  className,
  description,
  descriptionVariant = 'default',
  reserveDescriptionSpace,
  hideErrorMessage,
}: FormFieldProps) => {
  const { control } = useFormContext<FieldValues>();
  const { fieldState } = useController<FieldValues>({
    name,
    control,
  });

  const visibleError = hideErrorMessage ? undefined : fieldState.error;
  const message = visibleError?.message ?? description;
  const messageClassName = cn(
    'text-sm font-medium',
    visibleError
      ? 'text-destructive'
      : descriptionVariant === 'success'
        ? 'text-success'
        : 'text-muted-foreground'
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {label && (
        <Label htmlFor={name}>
          <span>
            {label}
            {required && <RequiredMark />}
          </span>
        </Label>
      )}
      {children}
      {(message || reserveDescriptionSpace) && (
        // pl-0.5(2px) - 입력칸 테두리 바로 아래 텍스트가 딱 붙어 시작하면 살짝
        // 답답해 보인다는 지적으로 추가(비밀번호 재설정 화면 검토 중 발견)
        <p className={cn(messageClassName, 'min-h-5 pl-0.5')}>{message}</p>
      )}
    </div>
  );
};
