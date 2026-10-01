import type { Meta, StoryObj } from '@storybook/react-vite';
import { useForm, FormProvider } from 'react-hook-form';
import { FormField } from '@/shared/ui/elements/form/_base/FormField';
import { Input } from '@/shared/ui/atoms/input';

function FormProviderDecorator(Story: React.ComponentType) {
  const methods = useForm({
    defaultValues: { username: '' },
  });
  return (
    <FormProvider {...methods}>
      <form className="w-80">
        <Story />
      </form>
    </FormProvider>
  );
}

const meta = {
  title: 'Shared/UI/Elements/Form/FormField',
  component: FormField,
  tags: ['autodocs'],
  decorators: [FormProviderDecorator],
  args: {
    name: 'username',
    children: <Input name="username" placeholder="Enter value..." />,
  },
} satisfies Meta<typeof FormField>;

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
    label: '사용자 이름',
    description: '다른 사람에게 보여지는 이름입니다.',
  },
};

export const WithSuccessDescription: Story = {
  args: {
    label: '사용자 이름',
    description: '사용 가능한 이름입니다.',
    descriptionVariant: 'success',
  },
};

export const Required: Story = {
  args: {
    label: '사용자 이름',
    required: true,
  },
};

function WithErrorStory() {
  const methods = useForm({
    defaultValues: { username: '' },
  });
  methods.setError('username', { type: 'required', message: '필수 입력 항목입니다.' });
  return (
    <FormProvider {...methods}>
      <form className="w-80">
        <FormField name="username" label="사용자 이름">
          <Input name="username" placeholder="Enter value..." />
        </FormField>
      </form>
    </FormProvider>
  );
}

export const WithError: Story = {
  render: () => <WithErrorStory />,
};

function WithHiddenErrorMessageStory() {
  const methods = useForm({
    defaultValues: { username: '' },
  });
  methods.setError('username', { type: 'required', message: '필수 입력 항목입니다.' });
  return (
    <FormProvider {...methods}>
      <form className="w-80">
        <FormField name="username" label="사용자 이름" hideErrorMessage>
          <Input name="username" placeholder="Enter value..." />
          <p className="text-sm text-destructive pl-0.5">호출자가 직접 그리는 안내</p>
        </FormField>
      </form>
    </FormProvider>
  );
}

// 에러가 있어도 FormField 자신의 에러 문구는 그리지 않는다 - 호출자가 children으로 대신 안내한다
export const WithHiddenErrorMessage: Story = {
  render: () => <WithHiddenErrorMessageStory />,
};
