import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { GlobalImageViewer } from '@/shared/ui/elements/dialog/image-viewer/ImageViewer';
import { useImageViewer } from '@/shared/ui/elements/dialog/image-viewer/imageViewer.store';
import { Button } from '@/shared/ui/atoms/button';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { NavigationService } from '@/shared/lib/router/navigation';
import { RouterEvents } from '@/shared/lib/router/router-events';

// GlobalImageViewer가 마운트 즉시 useBackClosableOverlay(useNavigate)를 호출한다 - <Router> 조상 없이는 렌더
// 자체가 크래시한다(addon-vitest가 스토리를 실제 컴포넌트 테스트로 실행하면서 2026-09-16 처음 발견). 그 훅은
// 열림을 라우터가 가 있는 위치(RouterEvents)에서 읽어, MemoryRouter 아래에서는 눌러도 창이 열리지 않는다.
// 그래서 앱의 RouterProvider.tsx와 같은 주입을 하되, 실제 브라우저 히스토리를 건드리지 않는 메모리 라우터를 쓴다.
function AppLikeRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: children }]));

  useEffect(() => {
    NavigationService.setNavigate(router.navigate.bind(router));
    RouterEvents.setSource(router);
  }, [router]);

  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

const meta = {
  title: 'Shared/UI/Elements/Dialog/ImageViewer',
  component: GlobalImageViewer,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <AppLikeRouter>
        <Story />
      </AppLikeRouter>
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
