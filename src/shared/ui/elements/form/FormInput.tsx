import { Input } from '@/shared/ui/atoms/input';
import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';

export interface FormInputProps extends React.ComponentProps<'input'> {
  name: string;
  label?: string;
  description?: string;
  descriptionVariant?: 'default' | 'success';
  reserveDescriptionSpace?: boolean;
  enableClear?: boolean;
}

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
  const { control } = useFormContext<FieldValues>();
  // ref를 따로 떼어 둔다 - field.ref를 쓰면 React Compiler 린트가 field 전체를 ref로 오인해
  // field.value 읽기까지 refs 위반으로 잡는다(https://react.dev/reference/eslint-plugin-react-hooks/lints/refs)
  const {
    field: { ref: inputRef, ...field },
    fieldState,
  } = useController<FieldValues>({
    name,
    control,
  });

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
      <Input
        id={name}
        name={name}
        value={field.value as string}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onClear={enableClear && field.value ? () => field.onChange('') : undefined}
        ref={inputRef}
        required={required}
        className={fieldState.error ? 'border-destructive focus-visible:ring-destructive' : ''}
        {...props}
      />
    </FormField>
  );
};
