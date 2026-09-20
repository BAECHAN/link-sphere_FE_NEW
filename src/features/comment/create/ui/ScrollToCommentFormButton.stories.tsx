import type { Meta, StoryObj } from '@storybook/react';
import { useRef } from 'react';
import { ScrollToCommentFormButton } from '@/features/comment/create/ui/ScrollToCommentFormButton';

function Demo() {
  const targetRef = useRef<HTMLDivElement>(null);

  return (
    <div className="min-h-[200vh] w-full p-4">
      <div className="bg-muted p-4 rounded-lg mb-[150vh]">
        <p className="text-sm text-muted-foreground">
          아래로 스크롤해 댓글 작성 폼(회색 박스)이 화면 밖으로 나가면 버튼이 나타납니다.
        </p>
      </div>
      <div ref={targetRef} className="bg-primary/10 p-8 rounded-lg">
        댓글 작성 폼 자리
      </div>
      <ScrollToCommentFormButton targetRef={targetRef} />
    </div>
  );
}

const meta: Meta<typeof Demo> = {
  title: 'Temp/ScrollToCommentFormButton',
  component: Demo,
} satisfies Meta<typeof Demo>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
