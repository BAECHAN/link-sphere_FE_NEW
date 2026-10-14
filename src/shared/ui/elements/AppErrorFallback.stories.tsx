import type { Meta, StoryObj } from '@storybook/react-vite';
import { chunkReloadKey } from '@/shared/config/storage-keys';
import { AppErrorFallback } from '@/shared/ui/elements/AppErrorFallback';

const meta = {
  title: 'Shared/UI/Elements/AppErrorFallback',
  component: AppErrorFallback,
  tags: ['autodocs'],
} satisfies Meta<typeof AppErrorFallback>;

/* eslint-disable import/no-default-export */
export default meta;
type Story = StoryObj<typeof meta>;

// 첫 청크 로드 실패·5xx 에러는 window.location 새로고침·리다이렉트를 트리거해 Storybook에서
// 재현할 수 없다 - 안내 화면이 그려지는 경로만 보여준다.
export const Default: Story = {
  args: {
    error: new Error('예상치 못한 오류'),
  },
};

// 같은 경로에서 이미 한 번 새로고침했는데 또 청크 로드에 실패한 경우 - 새로고침하지 않고
// 일반 안내 화면과 홈 버튼을 보여준다. 재시도 기록을 미리 남겨 두고 스토리가 끝나면 지운다.
export const ChunkLoadErrorRetried: Story = {
  args: {
    error: new TypeError('Failed to fetch dynamically imported module: /assets/js/PostPage-abc.js'),
  },
  beforeEach: () => {
    const reloadKey = chunkReloadKey(window.location.pathname);
    sessionStorage.setItem(reloadKey, '1');

    return () => sessionStorage.removeItem(reloadKey);
  },
};
