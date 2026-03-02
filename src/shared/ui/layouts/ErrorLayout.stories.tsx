import type { Meta, StoryObj } from '@storybook/react';
import { fn } from 'storybook/test';
import { ErrorLayout } from '@/shared/ui/layouts/ErrorLayout';

const meta = {
  title: 'Shared/UI/Layouts/ErrorLayout',
  component: ErrorLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    title: { control: 'text' },
    description: { control: 'text' },
  },
  args: {
    title: '404',
    description: '페이지를 찾을 수 없습니다.',
    onHomeClick: fn(),
  },
} satisfies Meta<typeof ErrorLayout>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NotFound: Story = {
  args: {
    title: '404',
    description: '요청하신 페이지를 찾을 수 없습니다.',
  },
};

export const ServerError: Story = {
  args: {
    title: '500',
    description: '서버에서 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
  },
};

export const Forbidden: Story = {
  args: {
    title: '403',
    description: '이 페이지에 접근할 권한이 없습니다.',
  },
};

export const WithChildren: Story = {
  args: {
    title: '오류 발생',
    description: '예상치 못한 오류가 발생했습니다.',
    children: (
      <div className="mb-4 p-3 bg-red-50 rounded border border-red-200 text-sm text-red-700">
        Error: Cannot read properties of undefined
      </div>
    ),
  },
};

export const NoHomeButton: Story = {
  args: {
    title: '오류 발생',
    description: '잠시 후 다시 시도해주세요.',
    onHomeClick: undefined,
  },
};
