import type { Meta, StoryObj } from '@storybook/react';
import { useForm, FormProvider } from 'react-hook-form';
import { FormInput } from '@/shared/ui/elements/form/FormInput';

function FormProviderDecorator(Story: React.ComponentType) {
  const methods = useForm({
    defaultValues: { username: '', email: '' },
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
  title: 'Shared/UI/Elements/Form/FormInput',
  component: FormInput,
  tags: ['autodocs'],
  decorators: [FormProviderDecorator],
  args: {
    name: 'username',
    placeholder: 'Enter value...',
  },
} satisfies Meta<typeof FormInput>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    label: '사용자 이름',
  },
};

export const WithDescription: Story = {
  args: {
    label: '이메일',
    name: 'email',
    description: '로그인에 사용되는 이메일 주소입니다.',
    placeholder: 'user@example.com',
  },
};

export const WithClear: Story = {
  args: {
    label: '검색어',
    enableClear: true,
    placeholder: '입력 후 X 버튼으로 지울 수 있습니다.',
  },
};

function WithErrorStory() {
  const methods = useForm({
    defaultValues: { fieldWithError: '' },
  });
  methods.setError('fieldWithError', { type: 'required', message: '필수 입력 항목입니다.' });
  return (
    <FormProvider {...methods}>
      <form className="w-80">
        <FormInput name="fieldWithError" label="에러 상태" placeholder="에러 예시" />
      </form>
    </FormProvider>
  );
}

export const WithError: Story = {
  render: () => <WithErrorStory />,
};
