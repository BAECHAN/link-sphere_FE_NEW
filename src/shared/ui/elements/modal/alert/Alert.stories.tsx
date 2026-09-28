import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalAlerts } from '@/shared/ui/elements/modal/alert/Alert';
import { useAlert } from '@/shared/ui/elements/modal/alert/alert.store';
import { Button } from '@/shared/ui/atoms/button';

const meta = {
  title: 'Shared/UI/Elements/Modal/Alert',
  component: GlobalAlerts,
  tags: ['autodocs'],
  // Alert가 마운트 즉시 useLocation()을 호출한다 - <Router> 조상 없이는 렌더 자체가
  // 크래시한다(ImageViewer.stories.tsx와 동일한 문제, 같은 해법).
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
} satisfies Meta<typeof GlobalAlerts>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

function AlertDemo() {
  const { openAlert } = useAlert();
  return (
    <div className="flex flex-col gap-3">
      <GlobalAlerts />
      <Button
        variant="outline"
        onClick={() =>
          openAlert({
            title: '알림',
            message: '작업이 완료되었습니다.',
          })
        }
      >
        Simple Alert 열기
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          openAlert({
            message: '제목 없이 메시지만 표시됩니다.',
          })
        }
      >
        No-title Alert 열기
      </Button>
    </div>
  );
}

export const Default: Story = {
  render: () => <AlertDemo />,
};

function ConfirmDemo() {
  const { openConfirm } = useAlert();
  return (
    <div className="flex flex-col gap-3">
      <GlobalAlerts />
      <Button
        variant="outline"
        onClick={() =>
          openConfirm({
            title: '삭제 확인',
            message: '정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
            confirmText: '삭제',
            cancelText: '취소',
          })
        }
      >
        Confirm 열기
      </Button>
    </div>
  );
}

export const Confirm: Story = {
  render: () => <ConfirmDemo />,
};

// emphasis: 'confirm' 데모 — 어느 방향도 위험하지 않은 토글(공개 설정 등)에서만 쓴다.
// 기본값('cancel')과 반대로 확인이 채움·오른쪽·초기 포커스를 받는다(usePostCard.ts 실사용례).
function ConfirmEmphasizeConfirmDemo() {
  const { openConfirm } = useAlert();
  return (
    <div className="flex flex-col gap-3">
      <GlobalAlerts />
      <Button
        variant="outline"
        onClick={() =>
          openConfirm({
            title: '공개 설정 변경',
            message: '이 게시물을 나만 보기(비공개)로 전환할까요?',
            confirmText: '확인',
            cancelText: '취소',
            emphasis: 'confirm',
          })
        }
      >
        Confirm(emphasis: confirm) 열기
      </Button>
    </div>
  );
}

export const ConfirmEmphasizeConfirm: Story = {
  render: () => <ConfirmEmphasizeConfirmDemo />,
};

function MultipleAlertsDemo() {
  const { openAlert, openConfirm } = useAlert();
  return (
    <div className="flex flex-wrap gap-3">
      <GlobalAlerts />
      <Button variant="outline" onClick={() => openAlert({ message: '첫 번째 알림' })}>
        Alert 1
      </Button>
      <Button variant="outline" onClick={() => openAlert({ message: '두 번째 알림' })}>
        Alert 2
      </Button>
      <Button
        variant="outline"
        onClick={() =>
          openConfirm({
            title: '확인',
            message: '계속하시겠습니까?',
          })
        }
      >
        Confirm
      </Button>
    </div>
  );
}

export const MultipleAlerts: Story = {
  render: () => <MultipleAlertsDemo />,
};
