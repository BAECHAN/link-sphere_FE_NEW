import type { Meta, StoryObj } from '@storybook/react';
import { AuthLayout } from '@/shared/ui/layouts/AuthLayout';
import { Button } from '@/shared/ui/atoms/button';
import { Input } from '@/shared/ui/atoms/input';
import { Label } from '@/shared/ui/atoms/label';

const meta = {
  title: 'Shared/UI/Layouts/AuthLayout',
  component: AuthLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
  },
  args: {
    children: <></>,
  },
} satisfies Meta<typeof AuthLayout>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-sm p-8 space-y-4">
        <h2 className="text-2xl font-bold text-center">로그인</h2>
        <div className="space-y-2">
          <Label htmlFor="email">이메일</Label>
          <Input id="email" type="email" placeholder="user@example.com" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">비밀번호</Label>
          <Input id="password" type="password" placeholder="비밀번호" />
        </div>
        <Button className="w-full">로그인</Button>
      </div>
    </AuthLayout>
  ),
};

export const WithCard: Story = {
  render: () => (
    <AuthLayout>
      <div className="bg-white rounded-lg shadow-sm p-8 text-center space-y-4">
        <h2 className="text-2xl font-bold">회원가입</h2>
        <p className="text-muted-foreground">계정을 만들어 Link Sphere를 시작하세요.</p>
        <Button className="w-full">Google로 시작하기</Button>
        <Button variant="outline" className="w-full">
          이메일로 시작하기
        </Button>
      </div>
    </AuthLayout>
  ),
};
