import type { Meta, StoryObj } from '@storybook/react-vite';
import { Toaster } from '@/shared/ui/atoms/sonner';
import { toast } from '@/shared/lib/toast/toast';
import { showLeftPageFailureToast } from '@/shared/lib/toast/LeftPageFailureToast';
import { Button } from '@/shared/ui/atoms/button';
import { TEXTS } from '@/shared/config/texts';

const meta = {
  title: 'Shared/UI/Atoms/Sonner',
  component: Toaster,
  tags: ['autodocs'],
} satisfies Meta<typeof Toaster>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col gap-2 pointer-events-auto">
      {/* Note here: Toaster renders a fixed overlay. In Storybook docs mode this might overlap other things.
           But it's essential to see how it looks. */}
      <Toaster />
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          onClick={() =>
            toast('Event has been created', {
              description: 'Sunday, December 03, 2023 at 9:00 AM',
              action: {
                label: 'Undo',
                onClick: () => console.log('Undo'),
              },
            })
          }
        >
          Show Toast
        </Button>
        <Button variant="outline" onClick={() => toast.success('Event has been created')}>
          Success
        </Button>
        <Button variant="outline" onClick={() => toast.info('Event description message')}>
          Info
        </Button>
        <Button variant="outline" onClick={() => toast.error('Event has not been created')}>
          Error
        </Button>
        <Button variant="outline" onClick={() => toast.warning('Event has been warning')}>
          Warning
        </Button>
      </div>
    </div>
  ),
};

// 래퍼(shared/lib/toast/toast.ts)가 문장 끝에서 줄을 바꾼다 - 두 문장은 문장마다 한 줄,
// 한 줄보다 긴 문장(마지막 버튼)은 그 문장 안에서만 다시 줄이 바뀐다
const SENTENCE_LINE_BREAKS = [
  { label: '두 문장 (info)', show: () => toast.info(TEXTS.messages.info.sessionExpired) },
  { label: '두 문장 (success)', show: () => toast.success(TEXTS.messages.success.signUpCompleted) },
  {
    label: '두 문장 (error)',
    show: () => toast.error(TEXTS.messages.error.postSubmit.urlInvalid),
  },
  { label: '세 문장 (긴 문장)', show: () => toast.error(TEXTS.messages.error.edgeBlocked) },
];

export const SentenceLineBreak: Story = {
  render: () => (
    <div className="flex flex-col gap-2 pointer-events-auto">
      <Toaster />
      <div className="flex flex-wrap gap-2">
        {SENTENCE_LINE_BREAKS.map(({ label, show }) => (
          <Button key={label} variant="outline" onClick={show}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  ),
};

const { leftPageFailure, postSubmit } = TEXTS.messages.error;

// 저장 요청 중 떠난 뒤 실패했을 때의 토스트(useSignUp·useCreatePost·useUpdatePost) - 닫을 때까지 남고,
// 버튼은 그 폼으로 돌아가 입력을 되살린다. 글이 삭제돼 다시 수정할 수 없으면 버튼이 없다
const LEFT_PAGE_FAILURES = [
  {
    label: '가입 - 닉네임 중복',
    title: leftPageFailure.signUpTitle,
    description: leftPageFailure.signUpDuplicateNickname,
    actionLabel: TEXTS.buttons.signUpAgain,
  },
  {
    label: '가입 - 이메일 중복',
    title: leftPageFailure.signUpTitle,
    description: TEXTS.auth.signup.emailDuplicate,
    actionLabel: TEXTS.buttons.login,
  },
  {
    label: '가입 - 그 밖',
    title: leftPageFailure.signUpTitle,
    description: leftPageFailure.retryLater,
    actionLabel: TEXTS.buttons.signUpAgain,
  },
  {
    label: '등록 - 폴더 없음',
    title: leftPageFailure.postCreateTitle,
    description: postSubmit.folderNotFound,
    actionLabel: TEXTS.buttons.createPostAgain,
  },
  {
    label: '등록 - 일시적 실패',
    title: leftPageFailure.postCreateTitle,
    description: leftPageFailure.retryLater,
    actionLabel: TEXTS.buttons.createPostAgain,
  },
  {
    label: '수정 - 주소 오류',
    title: leftPageFailure.postUpdateTitle,
    description: postSubmit.urlUnresolvable,
    actionLabel: TEXTS.buttons.updatePostAgain,
  },
  {
    label: '수정 - 글 삭제됨',
    title: leftPageFailure.postUpdateTitle,
    description: postSubmit.postDeleted,
    actionLabel: null,
  },
];

export const LeftPageFailure: Story = {
  render: () => (
    <div className="flex flex-col gap-2 pointer-events-auto">
      <Toaster />
      <div className="flex flex-wrap gap-2">
        {LEFT_PAGE_FAILURES.map(({ label, title, description, actionLabel }) => (
          <Button
            key={label}
            variant="outline"
            onClick={() =>
              showLeftPageFailureToast({
                key: label,
                title,
                description,
                ...(actionLabel && {
                  action: { label: actionLabel, onClick: () => console.log(actionLabel) },
                }),
              })
            }
          >
            {label}
          </Button>
        ))}
      </div>
    </div>
  ),
};
