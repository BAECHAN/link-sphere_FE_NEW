import type { Meta, StoryObj } from '@storybook/react';
import { MemoryRouter } from 'react-router-dom';
import { GlobalImageViewer } from '@/shared/ui/elements/modal/image-viewer/ImageViewer';
import { useImageViewer } from '@/shared/ui/elements/modal/image-viewer/imageViewer.store';
import { Button } from '@/shared/ui/atoms/button';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';

const meta = {
  title: 'Shared/UI/Elements/Modal/ImageViewer',
  component: GlobalImageViewer,
  tags: ['autodocs'],
  // GlobalImageViewer가 마운트 즉시 useHistoryOverlay(useNavigate)를 호출한다 -
  // <Router> 조상 없이는 렌더 자체가 크래시한다(addon-vitest가 스토리를 실제
  // 컴포넌트 테스트로 실행하면서 2026-09-16 처음 발견). 실제 앱은 App.tsx의
  // RouterProvider(createBrowserRouter)가 이 컨텍스트를 제공하므로, 스토리에서는
  // 실제 브라우저 히스토리를 건드리지 않는 MemoryRouter로 동일한 컨텍스트만 준다.
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
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

/**
 * 가로형·세로형 이미지가 섞인 갤러리 - 이전/다음 버튼이 이미지 비율과 무관하게
 * 항상 같은 화면 위치에 있는지(연속 클릭이 가능한지) 확인하기 위한 스토리.
 * 실제 소비 지점(MarkdownContent)을 그대로 통합해 프로덕션 경로를 검증한다.
 */
export const MixedAspectRatioGallery: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      <GlobalImageViewer />
      <MarkdownContent
        content={[
          'https://picsum.photos/seed/link-sphere-landscape/1200/675.jpg',
          'https://picsum.photos/seed/link-sphere-portrait/900/1600.jpg',
          'https://picsum.photos/seed/link-sphere-square/1000/1000.jpg',
        ].join('\n')}
      />
    </div>
  ),
};
