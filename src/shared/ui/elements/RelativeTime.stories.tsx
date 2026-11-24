import type { Meta, StoryObj } from '@storybook/react-vite';
import dayjs from 'dayjs';
import { RelativeTime } from '@/shared/ui/elements/RelativeTime';
import { DateUtil } from '@/shared/utils/date.util';

// 스토리를 연 순간을 기준으로 삼는다 - 열어 두면 1분마다 글자가 바뀌는 것을 볼 수 있다
const OPENED_AT = dayjs();

function formatRelativeShort(date: string, now: number) {
  return DateUtil.formatRelativeShort(date, now);
}

const meta = {
  title: 'Shared/UI/Elements/RelativeTime',
  component: RelativeTime<string>,
  tags: ['autodocs'],
  args: {
    date: OPENED_AT.toISOString(),
    format: formatRelativeShort,
    className: 'text-xs text-muted-foreground',
  },
} satisfies Meta<typeof RelativeTime<string>>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

/** 방금 쓴 글 - 열어 둔 채 1분이 지나면 "1분 전"으로 바뀐다 */
export const Default: Story = {};

export const MinutesAgo: Story = {
  args: { date: OPENED_AT.subtract(3, 'minute').toISOString() },
};

export const HoursAgo: Story = {
  args: { date: OPENED_AT.subtract(18, 'hour').toISOString() },
};

export const DaysAgo: Story = {
  args: { date: OPENED_AT.subtract(3, 'day').toISOString() },
};
