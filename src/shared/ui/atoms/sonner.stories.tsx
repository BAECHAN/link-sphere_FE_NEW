import type { Meta, StoryObj } from '@storybook/react-vite';
import { Sparkles } from 'lucide-react';
import { Toaster } from '@/shared/ui/atoms/sonner';
import { toast } from '@/shared/lib/toast/toast';
import { showNoticeToast } from '@/shared/lib/toast/NoticeToast';
import { Button } from '@/shared/ui/atoms/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/shared/ui/atoms/dialog';
import { TEXTS } from '@/shared/config/texts';

const meta = {
  title: 'Shared/UI/Atoms/Sonner',
  component: Toaster,
  tags: ['autodocs'],
  parameters: {
    // 문서 페이지는 스토리를 한 화면에 함께 그리는데, sonner 토스트 저장소는 페이지에 하나라 한 스토리에서 띄운 토스트가
    // 모든 스토리의 Toaster에 떴다. 스토리마다 iframe으로 그려 저장소를 나눈다 - iframe에서는 컨트롤이 스토리를 갱신하지
    // 못하지만(https://storybook.js.org/docs/api/doc-blocks/doc-block-story#inline) 이 스토리들은 args를 쓰지 않는다.
    // 높이는 한 번에 보이는 토스트 최대 3개(sonner 기본값)를 펼쳐도 잘리지 않고 모달과 겹치지 않는 값이다
    docs: { story: { inline: false, height: '480px' } },
  },
} satisfies Meta<typeof Toaster>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

interface ToastSample {
  label: string;
  show: () => void;
}

// 견본 버튼 줄 - 토스터는 화면에 고정된 층이라 문서 모드에서는 다른 스토리 위에 겹쳐 보일 수 있다
function ToastSamples({ samples }: { samples: ToastSample[] }) {
  return (
    <div className="flex flex-col gap-2 pointer-events-auto">
      <Toaster />
      <div className="flex flex-wrap gap-2">
        {samples.map(({ label, show }) => (
          <Button key={label} variant="outline" onClick={show}>
            {label}
          </Button>
        ))}
      </div>
    </div>
  );
}

// 버튼 없는 토스트 - 종류마다 색·아이콘이 다르고 닫기 X가 줄 끝에 있다
const KINDS: ToastSample[] = [
  { label: '성공', show: () => toast.success(TEXTS.messages.success.bookmarkRemoved) },
  { label: '안내', show: () => toast.info(TEXTS.messages.info.switchedToOtherAccount) },
  { label: '오류', show: () => toast.error(TEXTS.messages.error.bookmarkRestoreFailed) },
  { label: '경고', show: () => toast.warning(TEXTS.messages.error.edgeBlocked) },
];

export const Kinds: Story = {
  render: () => <ToastSamples samples={KINDS} />,
};

const logAction = (label: string) => ({ label, onClick: () => console.log(label) });

// 버튼(action)의 자리는 호출부가 아니라 래퍼가 정한다(shared/lib/toast/toast-layout.ts). 문구가 한 줄이면
// 같은 줄 오른쪽이고 닫기 X가 없다
const INLINE_ACTIONS: ToastSample[] = [
  {
    label: '저장 + 보기',
    show: () =>
      toast.success(TEXTS.messages.success.bookmarkSavedTo('개발'), {
        action: logAction(TEXTS.bookmark.folder.viewAction),
      }),
  },
  {
    // 한 줄 문구 중 가장 긴 경우(폴더 이름 최대 15자) - 좁은 화면에서 문구가 접히는지 보는 견본
    label: '15자 폴더 + 보기',
    show: () =>
      toast.success(TEXTS.messages.success.bookmarkSavedTo('가나다라마바사아자차카타파하가'), {
        action: logAction(TEXTS.bookmark.folder.viewAction),
      }),
  },
  {
    label: '삭제 + 되돌리기',
    show: () =>
      toast.success(TEXTS.messages.success.bookmarkRemoved, {
        action: logAction(TEXTS.bookmark.folder.undoAction),
      }),
  },
];

export const InlineAction: Story = {
  render: () => <ToastSamples samples={INLINE_ACTIONS} />,
};

// 문구가 여러 줄(문장이 둘 이상이거나 설명이 있다)이면 버튼은 문구 아래 줄 오른쪽, 닫기 X는 오른쪽 위다.
// 버튼이 문구 옆 세로 가운데에 끼는 모양은 쓰지 않는다(docs/UNSAVED-CHANGES-GUARD.md §5)
const STACKED_ACTIONS: ToastSample[] = [
  {
    label: '두 문장 + 버튼',
    show: () =>
      toast.info(TEXTS.messages.info.sessionExpired, {
        action: logAction(TEXTS.buttons.login),
      }),
  },
  {
    label: '문구 + 설명 + 버튼',
    show: () =>
      toast.success(TEXTS.messages.success.bookmarkRemovedFromFolder('개발'), {
        description: TEXTS.messages.success.bookmarkRemovedWithLastFolderDescription,
        action: logAction(TEXTS.bookmark.folder.undoAction),
      }),
  },
  {
    label: '제목 + 본문 + 버튼 (푸시 알림)',
    show: () =>
      toast(TEXTS.notification.defaultTitle, {
        description: TEXTS.messages.success.bookmarkRemovedWithLastFolderDescription,
        action: logAction(TEXTS.notification.viewAction),
      }),
  },
];

export const StackedAction: Story = {
  render: () => <ToastSamples samples={STACKED_ACTIONS} />,
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

const NOTICE = {
  errorTitle: '저장하지 못했어요',
  warningTitle: '저장 공간이 거의 찼어요',
  successTitle: '저장했어요',
  infoTitle: '새 버전이 있어요',
  description: '무슨 일이 있었는지 설명하는 문장이에요. 다음에 할 일을 알려주는 문장이에요.',
  action: '다시 시도',
};

// 안내 토스트(shared/lib/toast/NoticeToast.tsx) - 제목은 종류의 색, 설명은 본문색, 버튼은 설명 아래 오른쪽이다.
// 오류·경고는 닫을 때까지 남고 성공·안내는 저절로 사라진다. 아이콘은 종류의 기본값 대신 다른 것을 넣을 수 있다
const NOTICES: ToastSample[] = [
  {
    label: '오류',
    show: () =>
      showNoticeToast({
        variant: 'error',
        title: NOTICE.errorTitle,
        description: NOTICE.description,
        action: logAction(NOTICE.action),
      }),
  },
  {
    label: '경고',
    show: () =>
      showNoticeToast({
        variant: 'warning',
        title: NOTICE.warningTitle,
        description: NOTICE.description,
        action: logAction(NOTICE.action),
      }),
  },
  {
    label: '성공',
    show: () =>
      showNoticeToast({
        variant: 'success',
        title: NOTICE.successTitle,
        description: NOTICE.description,
        action: logAction(NOTICE.action),
      }),
  },
  {
    label: '안내',
    show: () =>
      showNoticeToast({
        variant: 'info',
        title: NOTICE.infoTitle,
        description: NOTICE.description,
        action: logAction(NOTICE.action),
      }),
  },
  {
    label: '아이콘 교체',
    show: () =>
      showNoticeToast({
        variant: 'info',
        title: NOTICE.infoTitle,
        description: NOTICE.description,
        icon: <Sparkles className="size-5" aria-hidden />,
        action: logAction(NOTICE.action),
      }),
  },
  {
    label: '버튼 없음',
    show: () =>
      showNoticeToast({
        variant: 'error',
        title: NOTICE.errorTitle,
        description: NOTICE.description,
      }),
  },
];

export const Notice: Story = {
  render: () => <ToastSamples samples={NOTICES} />,
};

const { leftPageFailure, postSubmit } = TEXTS.messages.error;

// 안내 토스트를 쓰는 실제 문구 - 저장 요청 중 떠난 뒤 실패했을 때(useSignUp·useCreatePost·useUpdatePost).
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

export const NoticeLeftPageFailure: Story = {
  render: () => (
    <div className="flex flex-col gap-2 pointer-events-auto">
      <Toaster />
      <div className="flex flex-wrap gap-2">
        {LEFT_PAGE_FAILURES.map(({ label, title, description, actionLabel }) => (
          <Button
            key={label}
            variant="outline"
            onClick={() =>
              showNoticeToast({
                variant: 'error',
                id: `left-page-failure:${label}`,
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

const OVER_MODAL = {
  open: '모달 열기',
  title: '모달 위의 토스트',
  description: '모달이 열린 채로도 토스트의 버튼과 닫기가 눌리고, 눌러도 모달은 닫히지 않아요.',
  show: '되돌리기 토스트 띄우기',
};

// Radix 모달은 열려 있는 동안 body에 pointer-events: none을 건다 - 토스터가 Radix Branch라 그 위에서도 눌리고,
// 토스트를 눌러도 "모달 바깥 클릭"으로 잡히지 않는다(sonner.tsx)
export const OverModal: Story = {
  render: () => (
    <div className="flex flex-col gap-2">
      <Toaster />
      <Dialog>
        <DialogTrigger asChild>
          <Button variant="outline">{OVER_MODAL.open}</Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{OVER_MODAL.title}</DialogTitle>
            <DialogDescription>{OVER_MODAL.description}</DialogDescription>
          </DialogHeader>
          <Button
            variant="outline"
            onClick={() =>
              toast.info(TEXTS.messages.info.sessionExpired, {
                duration: Infinity,
                action: {
                  label: TEXTS.bookmark.folder.undoAction,
                  onClick: () => console.log('undo'),
                },
              })
            }
          >
            {OVER_MODAL.show}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  ),
};
