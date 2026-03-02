import type { Meta, StoryObj } from '@storybook/react';
import { useForm, FormProvider } from 'react-hook-form';
import { FormCheckboxGroup } from '@/shared/ui/elements/form/FormCheckboxGroup';
import type { SelectOptionType } from '@/shared/types/common.type';

const CATEGORY_OPTIONS: SelectOptionType[] = [
  { value: 'tech', label: '기술' },
  { value: 'design', label: '디자인' },
  { value: 'business', label: '비즈니스' },
  { value: 'science', label: '과학' },
  { value: 'art', label: '예술' },
  { value: 'health', label: '건강' },
];

function FormProviderDecorator(Story: React.ComponentType) {
  const methods = useForm({
    defaultValues: { categories: [] as string[], tags: [] as string[] },
  });
  return (
    <FormProvider {...methods}>
      <form className="w-full max-w-md space-y-4">
        <Story />
      </form>
    </FormProvider>
  );
}

const meta = {
  title: 'Shared/UI/Elements/Form/FormCheckboxGroup',
  component: FormCheckboxGroup,
  tags: ['autodocs'],
  decorators: [FormProviderDecorator],
  argTypes: {
    disabled: { control: 'boolean' },
  },
  args: {
    name: 'categories',
    options: CATEGORY_OPTIONS,
  },
} satisfies Meta<typeof FormCheckboxGroup>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithLabel: Story = {
  args: {
    label: '관심 카테고리',
  },
};

export const Disabled: Story = {
  args: {
    label: '비활성화된 그룹',
    disabled: true,
  },
};

export const FewOptions: Story = {
  args: {
    label: '태그 선택',
    name: 'tags',
    options: [
      { value: 'react', label: 'React' },
      { value: 'typescript', label: 'TypeScript' },
      { value: 'nodejs', label: 'Node.js' },
    ],
  },
};
