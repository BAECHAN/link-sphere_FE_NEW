import { Input } from '@/shared/ui/atoms/input';
import { useController, useFormContext, type FieldValues } from 'react-hook-form';

interface FormInputProps extends React.ComponentProps<'input'> {
  name: string;
}

export const FormInput = ({ name, ...props }: FormInputProps) => {
  const { control } = useFormContext<FieldValues>();
  const { field } = useController<FieldValues>({
    name,
    control,
  });

  return (
    <Input
      {...props}
      value={field.value as string}
      onChange={field.onChange}
      onBlur={field.onBlur}
      ref={field.ref}
    />
  );
};
