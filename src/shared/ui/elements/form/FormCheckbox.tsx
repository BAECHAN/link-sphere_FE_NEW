import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import { Checkbox } from '@/shared/ui/atoms/checkbox';
import { Label } from '@/shared/ui/atoms/label';
import { cn } from '@/shared/lib/tailwind/utils';

interface FormCheckboxProps {
  name: string;
  label: string;
  description?: string;
  className?: string;
  disabled?: boolean;
}

export const FormCheckbox = ({
  name,
  label,
  description,
  className,
  disabled,
}: FormCheckboxProps) => {
  const { control } = useFormContext<FieldValues>();
  const { field, fieldState } = useController<FieldValues>({
    name,
    control,
  });

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center space-x-2">
        <Checkbox
          id={name}
          checked={field.value as boolean}
          onCheckedChange={field.onChange}
          disabled={disabled}
        />
        <Label
          htmlFor={name}
          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
        >
          {label}
        </Label>
      </div>
      {fieldState.error ? (
        <p className="text-sm font-medium text-destructive">{fieldState.error.message}</p>
      ) : (
        description && <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
};
