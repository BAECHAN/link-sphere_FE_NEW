import { useId, useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { CharacterCount } from '@/shared/ui/elements/CharacterCount';
import { Textarea } from '@/shared/ui/atoms/textarea';
import { TEXTS } from '@/shared/config/texts';

const meta = {
  title: 'Shared/UI/Elements/CharacterCount',
  component: CharacterCount,
  tags: ['autodocs'],
  args: {
    current: 0,
    max: 2000,
    suffix: TEXTS.comment.form.contentCountSuffix,
  },
} satisfies Meta<typeof CharacterCount>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const GroupedThousands: Story = {
  args: { current: 1234 },
};

export const AtLimit: Story = {
  args: { current: 2000 },
};

export const OverLimit: Story = {
  args: { current: 2016 },
};

/** 넘었을 때 이유 문구와 한 줄에 놓는 모양 - CommentForm·CommentEditForm이 이렇게 쓴다 */
export const BesideReason: Story = {
  args: { current: 2016 },
  render: (args) => (
    <div className="flex items-start gap-2">
      <p className="min-w-0 flex-1 text-xs text-destructive">
        {TEXTS.validation.commentContentTooLong}
      </p>
      <CharacterCount {...args} className="ml-auto shrink-0" />
    </div>
  ),
};

function CharacterCountWithTextarea() {
  const [value, setValue] = useState('');
  const countId = useId();

  return (
    <div className="space-y-2">
      <Textarea
        aria-label={TEXTS.comment.form.commentPlaceholder}
        aria-describedby={countId}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      {/* 세는 방법은 호출부가 정한다 - 여기서는 코드포인트 수로 센다 */}
      <CharacterCount id={countId} current={[...value].length} max={20} className="ml-auto w-fit" />
    </div>
  );
}

/** 입력칸의 aria-describedby가 글자 수를 가리켜 포커스할 때 함께 읽힌다 */
export const WithTextarea: Story = {
  render: () => <CharacterCountWithTextarea />,
};
