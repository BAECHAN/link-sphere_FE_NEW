import { useRef } from 'react';
import { Input } from '@/shared/ui/atoms/input';
import {
  get,
  useFormContext,
  useFormState,
  useWatch,
  type FieldError,
  type FieldValues,
} from 'react-hook-form';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';

export interface FormInputProps extends React.ComponentProps<'input'> {
  name: string;
  label?: string;
  description?: string;
  descriptionVariant?: 'default' | 'success';
  reserveDescriptionSpace?: boolean;
  enableClear?: boolean;
}

// 값은 register로 DOM이 들고 있어 입력할 때마다 다시 그려지지 않는다 - RHF FAQ가 ref가 닿는 네이티브 입력에
// 권하는 방식(https://react-hook-form.com/faqs "Should I use register or Controller?", docs/FE-ARCHITECTURE.md §16)
export const FormInput = ({
  name,
  label,
  className,
  description,
  descriptionVariant,
  reserveDescriptionSpace,
  enableClear,
  required,
  ...props
}: FormInputProps) => {
  const { register } = useFormContext<FieldValues>();
  const { errors } = useFormState({ name, exact: true });
  const error = get(errors, name) as FieldError | undefined;
  // 지우기 버튼은 값이 있는지만 알면 되므로 그것만 계산해 구독한다 - 빈칸↔값 있음이 바뀔 때만 다시 그린다
  // (https://react-hook-form.com/docs/usewatch 의 compute)
  const hasValue = useWatch({
    name,
    compute: (value: unknown) => Boolean(value),
    disabled: !enableClear,
  });
  const inputRef = useRef<HTMLInputElement | null>(null);
  const { ref: registerRef, ...registration } = register(name);

  // 글자를 다 지운 것과 같은 경로(register의 onChange)로 비워 dirty·검증 시점이 그대로 맞게 한다 -
  // setValue는 기본적으로 검증하지 않고 dirty도 다시 계산하지 않는다(https://react-hook-form.com/docs/useform/setvalue)
  const handleClear = () => {
    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.value = '';
    void registration.onChange({ target: input, type: 'change' });
  };

  return (
    <FormField
      name={name}
      label={label}
      required={required}
      className={className}
      description={description}
      descriptionVariant={descriptionVariant}
      reserveDescriptionSpace={reserveDescriptionSpace}
    >
      {/* 지우기 버튼(absolute)이 입력칸 기준으로 놓이게 감싼다 - PasswordInput·SearchInput과 같은 형태 */}
      <div className="relative">
        <Input
          id={name}
          required={required}
          className={error ? 'border-destructive focus-visible:ring-destructive' : ''}
          hasValue={hasValue}
          onClear={enableClear ? handleClear : undefined}
          {...props}
          {...registration}
          ref={(el) => {
            registerRef(el);
            inputRef.current = el;
          }}
        />
      </div>
    </FormField>
  );
};
