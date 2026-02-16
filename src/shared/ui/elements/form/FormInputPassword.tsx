import { Input } from '@/shared/ui/atoms/input';
import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';

interface FormInputPasswordProps extends React.ComponentProps<'input'> {
  name: string;
  label?: string;
  description?: string;
}

export const FormInputPassword = ({
  name,
  label,
  className,
  description,
  ...props
}: FormInputPasswordProps) => {
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
        ref={field.ref}
        type="password"
        className={fieldState.error ? 'border-destructive focus-visible:ring-destructive' : ''}
        {...props}
      />
    </FormField>
  );
};
