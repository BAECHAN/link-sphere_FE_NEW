import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import { useForm, FormProvider } from 'react-hook-form';
import { renderWithProviders } from '@/test/utils';
import { FormInput } from '@/shared/ui/elements/form/FormInput';

// FormInput은 자체 useForm 없이 useFormContext로만 동작하므로, 실제 폼을 흉내 낸
// 최소 harness로 감싼다 - 선례: PostCreateBookmarkFolderField.test.tsx의 Harness 패턴.
function Harness({ required }: { required?: boolean }) {
  const form = useForm({ defaultValues: { url: '' } });

  return (
    <FormProvider {...form}>
      <FormInput name="url" label="URL" required={required} />
    </FormProvider>
  );
}

describe('FormInput', () => {
  it('required가 true이면 라벨 옆에 aria-hidden 필수 표시(*)가 붙고 input에 required 속성이 붙는다', () => {
    const { container } = renderWithProviders(<Harness required />);

    const mark = container.querySelector('[aria-hidden="true"]');
    expect(mark).toHaveTextContent('*');

    const input = screen.getByRole('textbox', { name: 'URL' });
    expect(input).toBeRequired();
  });

  it('필수 표시가 aria-hidden이라 접근 가능한 이름은 마커 없이 라벨 그대로 유지된다', () => {
    renderWithProviders(<Harness required />);

    expect(screen.getByRole('textbox', { name: 'URL' })).toBeInTheDocument();
  });

  it('required가 없으면 필수 표시도 없고 input도 required가 아니다', () => {
    const { container } = renderWithProviders(<Harness />);

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'URL' })).not.toBeRequired();
  });
});
