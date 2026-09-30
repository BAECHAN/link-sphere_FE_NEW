import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalAlerts } from '@/shared/ui/elements/dialog/alert/Alert';
import { useAlert } from '@/shared/ui/elements/dialog/alert/alert.store';
import { Button } from '@/shared/ui/atoms/button';

const meta = {
  title: 'Shared/UI/Elements/Dialog/Alert',
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

// 삭제류 확인창 데모 — 메뉴에서 "삭제"를 직접 눌러야만 뜨므로 이미 삭제를 결심한
// 상태다. emphasis: 'confirm'으로 확인이 채움·오른쪽·초기 포커스를 받는다
// (usePostDelete.ts 등 실사용례, docs/DECISIONS.md 2026-09-29 팔로업 3).
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
            emphasis: 'confirm',
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

// 기본값('cancel') 데모 — 사용자가 의도치 않은 동작(뒤로가기 등)에 끼어드는 확인창이라
// 안전한 쪽(머무르기)이 채움·오른쪽·초기 포커스를 받는다(useUnsavedChangesGuard.ts 실사용례).
function ConfirmDefaultEmphasisDemo() {
  const { openConfirm } = useAlert();
  return (
    <div className="flex flex-col gap-3">
      <GlobalAlerts />
      <Button
        variant="outline"
        onClick={() =>
          openConfirm({
            title: '작성 중인 내용이 있어요',
            message: '이 페이지를 벗어나면 입력한 내용이 사라져요. 그래도 나갈까요?',
            confirmText: '나가기',
            cancelText: '계속 작성',
          })
        }
      >
        Confirm(기본값) 열기
      </Button>
    </div>
  );
}

export const ConfirmDefaultEmphasis: Story = {
  render: () => <ConfirmDefaultEmphasisDemo />,
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
