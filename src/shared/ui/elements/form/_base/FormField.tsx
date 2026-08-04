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
  /** true면 description/에러를 입력창 아래 별도 줄 대신 라벨과 같은 줄, 오른쪽 정렬로 보여준다.
   * 라벨 줄은 메시지 유무와 무관하게 항상 존재하므로 reserveDescriptionSpace 없이도 레이아웃이
   * 밀리지 않는다 */
  messageInLabelRow?: boolean;
}

export const FormField = ({
  name,
  label,
  children,
  className,
  description,
  descriptionVariant = 'default',
  reserveDescriptionSpace,
  messageInLabelRow,
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

  if (messageInLabelRow) {
    return (
      <div className={`flex flex-col gap-2 ${className ?? ''}`}>
        {(label || message) && (
          <div className="flex items-center justify-between gap-2">
            {label && (
              <Label htmlFor={name} className="shrink-0">
                {label}
              </Label>
            )}
            {/* Label이 leading-none이라 메시지도 같은 줄 높이를 써야 메시지 유무와 무관하게 줄
             * 높이가 고정된다. 줄바꿈을 허용하면 메시지가 길 때 두 줄로 밀려 높이가 또 바뀌므로,
             * 아예 줄바꿈을 막고(truncate) 1줄 높이로 고정한다 - 메시지는 짧게 쓰는 게 원칙이라
             * 실제로 잘릴 일은 거의 없지만, 잘리는 경우에도 title로 전체 텍스트를 볼 수 있다 */}
            {message && (
              <span title={message} className={`leading-none truncate min-w-0 ${messageClassName}`}>
                {message}
              </span>
            )}
          </div>
        )}
        {children}
      </div>
    );
  }

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
