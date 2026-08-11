import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import { Label } from '@/shared/ui/atoms/label';
import { PropsWithChildren } from 'react';

interface FormFieldProps extends PropsWithChildren {
  name: string;
  label?: string;
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
  const messageClassName = `text-sm font-medium ${
    fieldState.error
      ? 'text-destructive'
      : descriptionVariant === 'success'
        ? 'text-success'
        : 'text-muted-foreground'
  }`;

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      {label && <Label htmlFor={name}>{label}</Label>}
      {children}
      {(message || reserveDescriptionSpace) && (
        <p className={`${messageClassName} min-h-5`}>{message}</p>
      )}
    </div>
  );
};
