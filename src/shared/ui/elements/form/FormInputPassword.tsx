import { type ReactNode } from 'react';
import { PasswordInput } from '@/shared/ui/elements/PasswordInput';
import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';

export interface FormInputPasswordProps extends React.ComponentProps<'input'> {
  name: string;
  label?: string;
  description?: string;
  reserveDescriptionSpace?: boolean;
  hideErrorMessage?: boolean;
  /** 이 필드 값이 바뀔 때 함께 다시 검증할 필드(RHF `rules.deps`) - 예: 비밀번호를 고치면
   * 확인 칸의 불일치 에러도 즉시 갱신. RHF는 제출 전엔 검증 자체를 건너뛰므로 제출 후에만 동작한다 */
  deps?: string[];
  /** 입력칸 바로 아래에 그릴 내용(예: 비밀번호 조건 체크리스트) */
  belowInput?: ReactNode;
}

export const FormInputPassword = ({
  name,
  label,
  className,
  description,
  reserveDescriptionSpace,
  hideErrorMessage,
  deps,
  belowInput,
  required,
  onBlur,
  ...props
}: FormInputPasswordProps) => {
  const { control } = useFormContext<FieldValues>();
  const { field, fieldState } = useController<FieldValues>({
    name,
    control,
    rules: { deps },
  });

  return (
    <FormField
      name={name}
      label={label}
      required={required}
      className={className}
      description={description}
      reserveDescriptionSpace={reserveDescriptionSpace}
      hideErrorMessage={hideErrorMessage}
    >
      <PasswordInput
        id={name}
        name={name}
        value={field.value as string}
        onChange={field.onChange}
        // 호출자가 onBlur를 넘겨도 RHF의 blur 처리(touched)가 덮어써지지 않게 둘 다 부른다
        onBlur={(event) => {
          field.onBlur();
          onBlur?.(event);
        }}
        ref={field.ref}
        required={required}
        className={fieldState.error ? 'border-destructive focus-visible:ring-destructive' : ''}
        {...props}
      />
      {belowInput}
    </FormField>
  );
};
