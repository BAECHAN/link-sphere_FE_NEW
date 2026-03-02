import type { Meta, StoryObj } from '@storybook/react';
import { useForm, FormProvider } from 'react-hook-form';
import { FormCheckbox } from '@/shared/ui/elements/form/FormCheckbox';

function FormProviderDecorator(Story: React.ComponentType) {
  const methods = useForm({
    defaultValues: { agree: false, newsletter: false },
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
  title: 'Shared/UI/Elements/Form/FormCheckbox',
  component: FormCheckbox,
  tags: ['autodocs'],
  decorators: [FormProviderDecorator],
  argTypes: {
    disabled: { control: 'boolean' },
  },
  args: {
    name: 'agree',
    label: '이용약관에 동의합니다.',
  },
} satisfies Meta<typeof FormCheckbox>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithDescription: Story = {
  args: {
    description: '서비스 이용을 위해 약관에 동의해야 합니다.',
  },
};

export const Disabled: Story = {
  args: {
    disabled: true,
    label: '비활성화된 체크박스',
  },
};

export const Newsletter: Story = {
  args: {
    name: 'newsletter',
    label: '뉴스레터 수신에 동의합니다.',
    description: '최신 소식을 이메일로 받아보세요.',
  },
};
