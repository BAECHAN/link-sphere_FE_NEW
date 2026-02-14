import { Checkbox } from '@/shared/ui/atoms/checkbox';
import { useController, useFormContext, type FieldValues } from 'react-hook-form';
import type { SelectOptionType } from '@/shared/types/common.type';

interface FormCheckboxGroupProps {
  name: string;
  options: SelectOptionType[];
  disabled?: boolean;
}

export const FormCheckboxGroup = ({ name, options, disabled }: FormCheckboxGroupProps) => {
  const { control, getValues } = useFormContext<FieldValues>();
  const { field } = useController<FieldValues>({
    name,
    control,
  });

  const selectedValues: string[] = (field.value as string[]) ?? [];

  const handleToggle = (value: string, checked: boolean) => {
    const currentValues: string[] = (getValues(name) as string[]) ?? [];
    const updated = checked ? [...currentValues, value] : currentValues.filter((v) => v !== value);
    field.onChange(updated);
  };

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
      {options.map((option) => (
        <div key={option.value} className="flex items-center space-x-2">
          <Checkbox
            id={`${name}-${option.value}`}
            name={name}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={(checked) => handleToggle(option.value, !!checked)}
            disabled={disabled}
          />
          <label
            htmlFor={`${name}-${option.value}`}
            className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer select-none"
          >
            {option.label}
          </label>
        </div>
      ))}
    </div>
  );
};
