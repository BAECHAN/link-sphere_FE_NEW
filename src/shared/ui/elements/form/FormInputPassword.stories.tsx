import type { Meta, StoryObj } from '@storybook/react';
import { useForm, FormProvider } from 'react-hook-form';
import { FormInputPassword } from '@/shared/ui/elements/form/FormInputPassword';

function FormProviderDecorator(Story: React.ComponentType) {
  const methods = useForm({
    defaultValues: { password: '', confirmPassword: '' },
  });
  return (
    <FormProvider {...methods}>
      <form className="w-80 space-y-4">
        <Story />
      </form>
    </FormProvider>
  );
}

const meta = {
  title: 'Shared/UI/Elements/Form/FormInputPassword',
  component: FormInputPassword,
  tags: ['autodocs'],
  decorators: [FormProviderDecorator],
  args: {
    name: 'password',
    placeholder: '비밀번호를 입력하세요',
  },
} satisfies Meta<typeof FormInputPassword>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    label: '비밀번호',
  },
};

export const WithDescription: Story = {
  args: {
    label: '비밀번호',
    description: '8자 이상, 영문/숫자/특수문자를 포함해야 합니다.',
  },
};

export const ConfirmPassword: Story = {
  args: {
    name: 'confirmPassword',
    label: '비밀번호 확인',
    placeholder: '비밀번호를 다시 입력하세요',
  },
};
