import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// 패키지 단위 테스트. 루트 vitest.config.ts의 projects가 이 파일을 'ui' 프로젝트로 읽는다(`pnpm test`).
// 앱 설정(vitest.unit.ts)의 `@` 별칭과 setup(MSW·앱 스토어)을 물려받지 않는다 - 패키지가 앱 없이 도는지
// 확인하는 자리다(docs/DESIGN-SYSTEM-PRINCIPLES.md §1.5).
export default defineConfig({
  plugins: [react()],
  test: {
    name: 'ui',
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
});
