import { Input } from '@/shared/ui/atoms/input';
import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';

export interface FormInputProps extends React.ComponentProps<'input'> {
  name: string;
  label?: string;
  description?: string;
  enableClear?: boolean;
}

export const FormInput = ({
  name,
  label,
  className,
  description,
  enableClear,
  ...props
}: FormInputProps) => {
  const { control } = useFormContext<FieldValues>();
  const { field, fieldState } = useController<FieldValues>({
    name,
    control,
  });

  return (
    <FormField name={name} label={label} className={className} description={description}>
      <Input
        id={name}
        name={name}
        value={field.value as string}
        onChange={field.onChange}
        onBlur={field.onBlur}
        onClear={enableClear && field.value ? () => field.onChange('') : undefined}
        ref={field.ref}
        className={fieldState.error ? 'border-destructive focus-visible:ring-destructive' : ''}
        {...props}
      />
    </FormField>
  );
};
