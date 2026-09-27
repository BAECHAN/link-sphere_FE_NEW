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
}: FormFieldProps) => {
  const { control } = useFormContext<FieldValues>();
  const { fieldState } = useController<FieldValues>({
    name,
    control,
  });

  const message = fieldState.error?.message ?? description;
  const messageClassName = cn(
    'text-sm font-medium',
    fieldState.error
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
        <p className={cn(messageClassName, 'min-h-5')}>{message}</p>
      )}
    </div>
  );
};
