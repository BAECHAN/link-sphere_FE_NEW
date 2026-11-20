import type { Meta, StoryObj } from '@storybook/react-vite';
import { useEffect, useState, type ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { GlobalImageViewer } from '@/shared/ui/elements/dialog/image-viewer/GlobalImageViewer';
import {
  ImageViewer,
  type ImageViewerImage,
} from '@/shared/ui/elements/dialog/image-viewer/ImageViewer';
import { Button } from '@link-sphere/ui/atoms/button';
import { MarkdownContent } from '@/shared/ui/elements/MarkdownContent';
import { NavigationService } from '@/shared/lib/router/navigation';
import { RouterEvents } from '@/shared/lib/router/router-events';

const meta = {
  title: 'Shared/UI/Elements/Dialog/ImageViewer',
  component: ImageViewer,
  tags: ['autodocs'],
  args: {
    open: false,
    images: [],
    currentIndex: 0,
    onClose: () => {},
    onNext: () => {},
    onPrev: () => {},
  },
} satisfies Meta<typeof ImageViewer>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

// 열림과 지금 보는 순서를 쓰는 쪽이 쥔다 - ImageViewer는 속성만 받는다
function ControlledViewer({
  images,
  openLabel,
}: {
  images: ImageViewerImage[];
  openLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <ImageViewer
        open={open}
        onClose={() => setOpen(false)}
        images={images}
        currentIndex={currentIndex}
        onNext={() => setCurrentIndex((index) => Math.min(index + 1, images.length - 1))}
        onPrev={() => setCurrentIndex((index) => Math.max(index - 1, 0))}
      />
      <Button
        variant="outline"
        onClick={() => {
          setCurrentIndex(0);
          setOpen(true);
        }}
      >
        {openLabel}
      </Button>
    </div>
  );
}

export const Landscape: Story = {
  render: () => (
    <ControlledViewer
      images={[
        {
          src: 'https://picsum.photos/seed/link-sphere-landscape/1200/675',
          alt: '가로형 샘플 이미지',
        },
      ]}
      openLabel="가로형 이미지 확대"
    />
  ),
};

export const Portrait: Story = {
  render: () => (
    <ControlledViewer
      images={[
        {
          src: 'https://picsum.photos/seed/link-sphere-portrait/900/1600',
          alt: '세로형 샘플 이미지(긴 스크린샷)',
        },
      ]}
      openLabel="세로형 이미지 확대 (긴 스크린샷)"
    />
  ),
};

/**
 * 여러 장 - 이전/다음 버튼과 좌우 화살표 키로 넘긴다. 순서는 쓰는 쪽의 상태다.
 */
export const Gallery: Story = {
  render: () => (
    <ControlledViewer
      images={[
        {
          src: 'https://picsum.photos/seed/link-sphere-landscape/1200/675.jpg',
          alt: '가로형 샘플 이미지',
        },
        {
          src: 'https://picsum.photos/seed/link-sphere-portrait/900/1600.jpg',
          alt: '세로형 샘플 이미지',
        },
        {
          src: 'https://picsum.photos/seed/link-sphere-square/1000/1000.jpg',
          alt: '정사각형 샘플 이미지',
        },
      ]}
      openLabel="여러 장 확대"
    />
  ),
};

// 아래 두 스토리는 이 앱의 배선(GlobalImageViewer)을 본다. GlobalImageViewer가 마운트 즉시
// useBackClosableOverlay(useNavigate)를 호출한다 - <Router> 조상 없이는 렌더 자체가 크래시한다(addon-vitest가
// 스토리를 실제 컴포넌트 테스트로 실행하면서 2026-09-16 처음 발견). 그 훅은 열림을 라우터가 가 있는
// 위치(RouterEvents)에서 읽어, MemoryRouter 아래에서는 눌러도 창이 열리지 않는다. 그래서 앱의
// RouterProvider.tsx와 같은 주입을 하되, 실제 브라우저 히스토리를 건드리지 않는 메모리 라우터를 쓴다.
function AppLikeRouter({ children }: { children: ReactNode }) {
  const [router] = useState(() => createMemoryRouter([{ path: '*', element: children }]));

  useEffect(() => {
    NavigationService.setNavigate(router.navigate.bind(router));
    RouterEvents.setSource(router);
  }, [router]);

  return <RouterProvider router={router} future={{ v7_startTransition: true }} />;
}

/**
 * 실제 댓글 첨부 이미지 소비 지점(MarkdownContent)을 그대로 통합해
 * 클릭 → 열림 → ESC 닫기 흐름을 검증하기 위한 스토리.
 * 로컬 정적 파일을 참조해 네트워크 없이 결정적으로 로드된다.
 */
export const CommentAttachmentIntegration: Story = {
  render: () => (
    <AppLikeRouter>
      <div className="flex flex-col gap-3">
        <GlobalImageViewer />
        <MarkdownContent content="http://localhost:6006/favicons/android-chrome-512x512.png" />
      </div>
    </AppLikeRouter>
  ),
};

/**
 * 가로형·세로형 이미지가 섞인 갤러리 - 이전/다음 버튼이 이미지 비율과 무관하게
 * 항상 같은 화면 위치에 있는지(연속 클릭이 가능한지) 확인하기 위한 스토리.
 * 실제 소비 지점(MarkdownContent)을 그대로 통합해 프로덕션 경로를 검증한다.
 */
export const MixedAspectRatioGallery: Story = {
  render: () => (
    <AppLikeRouter>
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
    </AppLikeRouter>
  ),
};
