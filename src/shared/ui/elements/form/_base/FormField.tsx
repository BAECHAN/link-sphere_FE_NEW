import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import { Label } from '@/shared/ui/atoms/label';
import { PropsWithChildren } from 'react';

interface FormFieldProps extends PropsWithChildren {
  name: string;
  label?: string;
  className?: string;
  description?: string;
}

export const FormField = ({ name, label, children, className, description }: FormFieldProps) => {
  const { control } = useFormContext<FieldValues>();
  const { fieldState } = useController<FieldValues>({
    name,
    control,
  });

  return (
    <div className={`flex flex-col gap-2 ${className ?? ''}`}>
      {label && <Label htmlFor={name}>{label}</Label>}
      {children}
      {fieldState.error ? (
        <p className="text-sm font-medium text-destructive">{fieldState.error.message}</p>
      ) : (
        description && <p className="text-sm font-medium text-muted-foreground">{description}</p>
      )}
    </div>
  );
};
