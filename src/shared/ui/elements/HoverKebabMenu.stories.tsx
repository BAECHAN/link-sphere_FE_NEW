import type { Meta, StoryObj } from '@storybook/react';
import { Pencil, Trash } from 'lucide-react';
import { HoverKebabMenu } from '@/shared/ui/elements/HoverKebabMenu';
import { DropdownMenuItem } from '@/shared/ui/atoms/dropdown-menu';

const meta = {
  title: 'Shared/UI/Elements/HoverKebabMenu',
  component: HoverKebabMenu,
  tags: ['autodocs'],
  argTypes: {
    hoverReveal: { control: 'boolean' },
    'aria-label': { control: 'text' },
  },
  args: {
    'aria-label': '메뉴 열기',
    hoverReveal: false,
    children: (
      <>
        <DropdownMenuItem>
          <Pencil className="mr-2 h-4 w-4" />
          수정
        </DropdownMenuItem>
        <DropdownMenuItem className="text-destructive focus:text-destructive">
          <Trash className="mr-2 h-4 w-4" />
          삭제
        </DropdownMenuItem>
      </>
    ),
  },
} satisfies Meta<typeof HoverKebabMenu>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** PostCard 선례 — 항상 노출(hover-reveal 없음) */
export const AlwaysVisible: Story = {
  args: {
    hoverReveal: false,
  },
};

/** FolderTree 선례 — 부모 `group` hover 시에만 노출 */
export const HoverReveal: Story = {
  decorators: [
    (Story) => (
      <div className="group flex h-10 w-48 items-center justify-end rounded-md border px-2 hover:bg-accent">
        <Story />
      </div>
    ),
  ],
  args: {
    hoverReveal: true,
  },
};
