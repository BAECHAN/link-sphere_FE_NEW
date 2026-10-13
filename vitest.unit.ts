// vitest.config.ts의 unit 프로젝트와 뮤테이션 테스트(vitest.stryker.config.ts)가 함께 쓰는 설정.
// Stryker의 vitest 러너는 프로젝트를 고를 수 없고 브라우저 모드(storybook 프로젝트)를 지원하지 않아
// unit만 담은 설정이 따로 필요하다. 두 곳에 복사해 두면 한쪽만 바뀌어 어긋나므로 여기 한 곳에 둔다.
import path from 'path';

import react from '@vitejs/plugin-react';

export const sharedViteConfig = {
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
};

export const unitTestConfig = {
  name: 'unit',
  environment: 'jsdom',
  globals: true,
  setupFiles: ['./src/test/setup.ts'],
  include: ['src/**/*.{test,spec}.{ts,tsx}'],
  exclude: ['node_modules', 'dist', '.storybook', 'src/**/*.stories.{ts,tsx}'],
};
