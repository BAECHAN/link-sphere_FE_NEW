import type { Meta, StoryObj } from '@storybook/react';
import { GlobalImageViewer } from '@/shared/ui/elements/modal/image-viewer/ImageViewer';
import { useImageViewer } from '@/shared/ui/elements/modal/image-viewer/imageViewer.store';
import { Button } from '@/shared/ui/atoms/button';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';

const meta = {
  title: 'Shared/UI/Elements/Modal/ImageViewer',
  component: GlobalImageViewer,
  tags: ['autodocs'],
} satisfies Meta<typeof GlobalImageViewer>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

function LandscapeDemo() {
  const { openImageViewer } = useImageViewer();
  return (
    <div className="flex flex-col gap-3">
      <GlobalImageViewer />
      <Button
        variant="outline"
        onClick={() =>
          openImageViewer({
            src: 'https://picsum.photos/seed/link-sphere-landscape/1200/675',
            alt: '가로형 샘플 이미지',
          })
        }
      >
        가로형 이미지 확대
      </Button>
    </div>
  );
}

export const Landscape: Story = {
  render: () => <LandscapeDemo />,
};

function PortraitDemo() {
  const { openImageViewer } = useImageViewer();
  return (
    <div className="flex flex-col gap-3">
      <GlobalImageViewer />
      <Button
        variant="outline"
        onClick={() =>
          openImageViewer({
            src: 'https://picsum.photos/seed/link-sphere-portrait/900/1600',
            alt: '세로형 샘플 이미지(긴 스크린샷)',
          })
        }
      >
        세로형 이미지 확대 (긴 스크린샷)
      </Button>
    </div>
  );
}

export const Portrait: Story = {
  render: () => <PortraitDemo />,
};

/**
 * 실제 댓글 첨부 이미지 소비 지점(MarkdownContent)을 그대로 통합해
 * 클릭 → 열림 → ESC 닫기 흐름을 검증하기 위한 스토리.
 * 로컬 정적 파일을 참조해 네트워크 없이 결정적으로 로드된다.
 */
export const CommentAttachmentIntegration: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <GlobalImageViewer />
      <MarkdownContent content="http://localhost:6006/favicons/android-chrome-512x512.png" />
    </div>
  ),
};
